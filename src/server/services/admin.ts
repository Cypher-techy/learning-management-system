import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/format";
import { getAuth, hashPassword } from "../auth/auth";
import { db, schema, type DbOrTx } from "../db";
import { AppError, conflict, forbidden, invalid, notFound } from "../errors";
import {
  ALL_PERMISSIONS,
  assertCan,
  assertSignedIn,
  DELEGABLE,
  ROLES,
  type Actor,
  type Permission,
  type Role,
} from "../permissions";
import { logAudit } from "./audit";
import { withNotifications } from "./notifications";

const { users, accounts, sessions, profiles, instructorApplications, categories, tags, rolePermissions } = schema;

const password = z.string().min(10, "Use at least 10 characters.").max(128);
const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200);

// ===========================================================================
// Step-up authentication
// ===========================================================================

/**
 * Sensitive operations ask the administrator to re-enter their password, so a
 * hijacked or unattended session cannot be used for them on its own.
 */
export async function assertPasswordConfirmed(actor: Actor, candidate: string | undefined | null) {
  if (!candidate) throw invalid("Enter your password to confirm this action.", { confirmPassword: ["Required."] });
  const [account] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, actor.id), eq(accounts.providerId, "credential")));
  const ctx = await getAuth().$context;
  const ok = !!account?.password && (await ctx.password.verify({ hash: account.password, password: candidate }));
  if (!ok) {
    await logAudit(db, { actorId: actor.id, action: "auth.confirm_password_failed", entityType: "user", entityId: actor.id });
    throw invalid("That password is not correct.", { confirmPassword: ["Incorrect password."] });
  }
}

// ===========================================================================
// Account provisioning
// ===========================================================================

export const newAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name.").max(120),
  email,
  password,
  role: z.enum(ROLES),
});

/**
 * Creates a credential account directly. Used by the administrator UI, the
 * `admin:create` command and the development seed. Public registration never
 * reaches this function, so it is the only way a privileged role is assigned
 * at creation time.
 */
export async function provisionAccount(conn: DbOrTx, input: z.infer<typeof newAccountSchema>) {
  const data = newAccountSchema.parse(input);
  const [existing] = await conn.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (existing) throw invalid("An account with that email address already exists.", { email: ["Already registered."] });
  const hash = await hashPassword(data.password);
  const [user] = await conn
    .insert(users)
    .values({ name: data.name, email: data.email, role: data.role, emailVerified: true })
    .returning();
  await conn.insert(accounts).values({ userId: user!.id, accountId: user!.id, providerId: "credential", password: hash });
  await conn.insert(profiles).values({ userId: user!.id }).onConflictDoNothing();
  return user!;
}

export async function createUser(actor: Actor, input: z.infer<typeof newAccountSchema>) {
  assertCan(actor, "user.manage");
  if (input.role !== "student") assertCan(actor, "role.assign");
  return db.transaction(async (tx) => {
    const user = await provisionAccount(tx, input);
    await logAudit(tx, {
      actorId: actor.id,
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      metadata: { role: user.role },
    });
    return user;
  });
}

// ===========================================================================
// User management
// ===========================================================================

async function loadUser(conn: DbOrTx, userId: string) {
  const [user] = await conn.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound("The user");
  return user;
}

async function activeAdminCount(conn: DbOrTx, excludeId?: string) {
  const [row] = await conn
    .select({ n: count() })
    .from(users)
    .where(
      excludeId
        ? and(eq(users.role, "admin"), eq(users.banned, false), ne(users.id, excludeId))
        : and(eq(users.role, "admin"), eq(users.banned, false)),
    );
  return row?.n ?? 0;
}

export const editUserSchema = z.object({ name: z.string().trim().min(2).max(120), email });

export async function updateUser(actor: Actor, userId: string, input: z.infer<typeof editUserSchema>) {
  assertCan(actor, "user.manage");
  const data = editUserSchema.parse(input);
  await db.transaction(async (tx) => {
    const user = await loadUser(tx, userId);
    if (data.email !== user.email) {
      const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, data.email));
      if (taken) throw invalid("Another account already uses that email address.", { email: ["Already in use."] });
    }
    await tx.update(users).set({ name: data.name, email: data.email }).where(eq(users.id, userId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "user.update",
      entityType: "user",
      entityId: userId,
      metadata: { emailChanged: data.email !== user.email },
    });
  });
}

export async function setUserRole(actor: Actor, userId: string, role: Role, confirmPassword: string) {
  assertCan(actor, "role.assign");
  await assertPasswordConfirmed(actor, confirmPassword);
  if (userId === actor.id) throw forbidden("You cannot change your own role.");
  await withNotifications(async (tx, notify) => {
    const user = await loadUser(tx, userId);
    if (user.role === role) return;
    if (user.role === "admin" && (await activeAdminCount(tx, userId)) === 0) {
      throw conflict("This is the last active administrator. Promote someone else first.");
    }
    await tx.update(users).set({ role }).where(eq(users.id, userId));
    // Force a fresh sign-in so the old role cannot linger in a session.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "user.role_change",
      entityType: "user",
      entityId: userId,
      metadata: { from: user.role, to: role },
    });
    await notify({
      userIds: [userId],
      category: "security",
      title: "Your account role was changed",
      body: `Your role is now ${role}. Please sign in again.`,
    });
  });
}

/** Suspends an account and revokes every one of its sessions immediately. */
export async function suspendUser(actor: Actor, userId: string, reason: string, confirmPassword: string) {
  assertCan(actor, "user.manage");
  await assertPasswordConfirmed(actor, confirmPassword);
  if (userId === actor.id) throw forbidden("You cannot suspend your own account.");
  if (reason.trim().length < 5) throw invalid("Give a reason for the suspension.", { reason: ["Required."] });
  await db.transaction(async (tx) => {
    const user = await loadUser(tx, userId);
    if (user.role === "admin") {
      assertCan(actor, "role.assign");
      if ((await activeAdminCount(tx, userId)) === 0) throw conflict("This is the last active administrator.");
    }
    await tx.update(users).set({ banned: true, banReason: reason.trim().slice(0, 500) }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "user.suspend",
      entityType: "user",
      entityId: userId,
      metadata: { reason: reason.trim() },
    });
  });
}

export async function reactivateUser(actor: Actor, userId: string) {
  assertCan(actor, "user.manage");
  await db.transaction(async (tx) => {
    await loadUser(tx, userId);
    await tx.update(users).set({ banned: false, banReason: null }).where(eq(users.id, userId));
    await logAudit(tx, { actorId: actor.id, action: "user.reactivate", entityType: "user", entityId: userId });
  });
}

export async function revokeUserSessions(actor: Actor, userId: string) {
  assertCan(actor, "user.manage");
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await logAudit(db, { actorId: actor.id, action: "user.revoke_sessions", entityType: "user", entityId: userId });
}

/**
 * Data-deletion workflow: removes personal profile data and sign-in ability
 * while keeping the academic and financial records that must be retained
 * (grades, certificates, payments) attached to an anonymised account.
 */
export async function anonymizeUser(actor: Actor, userId: string, confirmPassword: string) {
  assertCan(actor, "user.manage");
  await assertPasswordConfirmed(actor, confirmPassword);
  if (userId === actor.id) throw forbidden("You cannot delete your own account here.");
  await db.transaction(async (tx) => {
    const user = await loadUser(tx, userId);
    if (user.role === "admin") throw conflict("Change this administrator's role before deleting the account.");
    await tx
      .update(users)
      .set({
        name: "Deleted user",
        email: `deleted-${userId}@deleted.invalid`,
        image: null,
        banned: true,
        banReason: "Account deleted",
        emailVerified: false,
      })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx
      .update(profiles)
      .set({ headline: null, bio: null, phone: null, country: null, deletionRequestedAt: null })
      .where(eq(profiles.userId, userId));
    await tx.delete(schema.lessonNotes).where(eq(schema.lessonNotes.userId, userId));
    await tx.delete(schema.bookmarks).where(eq(schema.bookmarks.userId, userId));
    await tx.delete(schema.notifications).where(eq(schema.notifications.userId, userId));
    await logAudit(tx, { actorId: actor.id, action: "user.anonymize", entityType: "user", entityId: userId });
  });
}

// ===========================================================================
// Own account
// ===========================================================================

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(120).default(""),
  bio: z.string().trim().max(2000).default(""),
  phone: z.string().trim().max(30).default(""),
  country: z.string().trim().max(80).default(""),
});

export async function updateOwnProfile(actor: Actor, input: z.infer<typeof profileSchema>) {
  assertSignedIn(actor);
  const data = profileSchema.parse(input);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: data.name }).where(eq(users.id, actor.id));
    const fields = {
      headline: data.headline || null,
      bio: data.bio || null,
      phone: data.phone || null,
      country: data.country || null,
    };
    await tx
      .insert(profiles)
      .values({ userId: actor.id, ...fields })
      .onConflictDoUpdate({ target: profiles.userId, set: fields });
  });
}

export async function updateNotificationPrefs(actor: Actor, prefs: { emailOff: string[]; inAppOff: string[] }) {
  assertSignedIn(actor);
  const clean = z
    .object({ emailOff: z.array(z.string().max(40)).max(20), inAppOff: z.array(z.string().max(40)).max(20) })
    .parse(prefs);
  await db
    .insert(profiles)
    .values({ userId: actor.id, notificationPrefs: clean })
    .onConflictDoUpdate({ target: profiles.userId, set: { notificationPrefs: clean } });
}

export async function requestAccountDeletion(actor: Actor) {
  assertSignedIn(actor);
  await db
    .insert(profiles)
    .values({ userId: actor.id, deletionRequestedAt: new Date() })
    .onConflictDoUpdate({ target: profiles.userId, set: { deletionRequestedAt: new Date() } });
  await db.insert(schema.supportRequests).values({
    userId: actor.id,
    name: actor.name,
    email: actor.email,
    subject: "Account deletion request",
    message: "This user asked for their account and personal data to be deleted.",
  });
}

// ===========================================================================
// Instructor applications
// ===========================================================================

export const applicationSchema = z.object({
  expertise: z.string().trim().min(10, "Describe your subject expertise (at least 10 characters).").max(1000),
  motivation: z.string().trim().min(20, "Tell us what you would like to teach (at least 20 characters).").max(2000),
});

export async function applyToTeach(actor: Actor, input: z.infer<typeof applicationSchema>) {
  assertSignedIn(actor);
  const data = applicationSchema.parse(input);
  if (actor.role !== "student") throw conflict("Your account can already create courses.");
  await withNotifications(async (tx, notify) => {
    const [pending] = await tx
      .select({ id: instructorApplications.id })
      .from(instructorApplications)
      .where(and(eq(instructorApplications.userId, actor.id), eq(instructorApplications.status, "pending")));
    if (pending) throw conflict("Your application is already being reviewed.");
    await tx.insert(instructorApplications).values({ ...data, userId: actor.id });
    const admins = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.banned, false)));
    await notify({
      userIds: admins.map((a) => a.id),
      category: "course_update",
      title: `New instructor application from ${actor.name}`,
      link: "/admin/instructors",
    });
  });
}

/** Approval is the only route by which a registered learner becomes an instructor. */
export async function reviewApplication(actor: Actor, applicationId: string, decision: "approve" | "reject", note: string) {
  assertCan(actor, "instructor.approve");
  await withNotifications(async (tx, notify) => {
    const [application] = await tx
      .select()
      .from(instructorApplications)
      .where(eq(instructorApplications.id, applicationId))
      .for("update");
    if (!application) throw notFound("The application");
    if (application.status !== "pending") throw conflict("This application has already been reviewed.");
    await tx
      .update(instructorApplications)
      .set({
        status: decision === "approve" ? "approved" : "rejected",
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewNote: note.trim().slice(0, 1000) || null,
      })
      .where(eq(instructorApplications.id, applicationId));
    if (decision === "approve") {
      const applicant = await loadUser(tx, application.userId);
      if (applicant.role === "student") {
        await tx.update(users).set({ role: "instructor" }).where(eq(users.id, applicant.id));
        await tx.delete(sessions).where(eq(sessions.userId, applicant.id));
      }
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: `instructor_application.${decision}`,
      entityType: "instructor_application",
      entityId: applicationId,
      metadata: { userId: application.userId },
    });
    await notify({
      userIds: [application.userId],
      category: "security",
      title: decision === "approve" ? "You are now an instructor" : "Your instructor application was not approved",
      body:
        decision === "approve"
          ? "Sign in again to open your instructor dashboard."
          : note.trim() || "You are welcome to apply again later.",
    });
  });
}

// ===========================================================================
// Categories and tags
// ===========================================================================

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  position: z.number().int().min(0).max(1000).default(0),
});

export async function saveCategory(actor: Actor, categoryId: string | null, input: z.infer<typeof categorySchema>) {
  assertCan(actor, "category.manage");
  const data = categorySchema.parse(input);
  const slug = slugify(data.name);
  if (!slug) throw invalid("Use letters or numbers in the category name.");
  const [clash] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(categoryId ? and(eq(categories.slug, slug), ne(categories.id, categoryId)) : eq(categories.slug, slug));
  if (clash) throw invalid("A category with that name already exists.", { name: ["Already exists."] });
  const fields = { name: data.name, slug, description: data.description || null, position: data.position };
  if (categoryId) await db.update(categories).set(fields).where(eq(categories.id, categoryId));
  else await db.insert(categories).values(fields);
  await logAudit(db, {
    actorId: actor.id,
    action: categoryId ? "category.update" : "category.create",
    entityType: "category",
    entityId: categoryId,
    metadata: { name: data.name },
  });
}

export async function deleteCategory(actor: Actor, categoryId: string) {
  assertCan(actor, "category.manage");
  await db.delete(categories).where(eq(categories.id, categoryId));
  await logAudit(db, { actorId: actor.id, action: "category.delete", entityType: "category", entityId: categoryId });
}

export async function createTag(actor: Actor, name: string) {
  assertCan(actor, "category.manage");
  const clean = z.string().trim().min(2).max(40).parse(name);
  const slug = slugify(clean);
  if (!slug) throw invalid("Use letters or numbers in the tag name.");
  await db.insert(tags).values({ name: clean, slug }).onConflictDoNothing();
}

export async function deleteTag(actor: Actor, tagId: string) {
  assertCan(actor, "category.manage");
  await db.delete(tags).where(eq(tags.id, tagId));
}

// ===========================================================================
// Permission matrix
// ===========================================================================

export async function setRolePermissions(
  actor: Actor,
  role: Exclude<Role, "admin">,
  granted: string[],
  confirmPassword: string,
) {
  assertCan(actor, "role.assign");
  await assertPasswordConfirmed(actor, confirmPassword);
  const delegable = DELEGABLE[role];
  const unknown = granted.filter((p) => !(ALL_PERMISSIONS as string[]).includes(p));
  if (unknown.length > 0) throw new AppError("VALIDATION", "Unknown permission.");
  const want = new Set(granted.filter((p) => (delegable as string[]).includes(p)) as Permission[]);
  await db.transaction(async (tx) => {
    for (const permission of delegable) {
      const allowed = want.has(permission);
      await tx
        .insert(rolePermissions)
        .values({ role, permission, allowed, updatedBy: actor.id })
        .onConflictDoUpdate({
          target: [rolePermissions.role, rolePermissions.permission],
          set: { allowed, updatedBy: actor.id, updatedAt: new Date() },
        });
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: "permissions.update",
      entityType: "role",
      entityId: role,
      metadata: { granted: [...want] },
    });
  });
}

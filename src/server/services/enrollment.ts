import { and, count, eq, inArray } from "drizzle-orm";
import { schema, type DbOrTx, type Tx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { withNotifications, type Notify } from "./notifications";
import { awardBadge, evaluateCompletion, recordActivity } from "./progress";
import { getSettings } from "./settings";

const { courses, enrollments, users } = schema;

export async function getEnrollment(conn: DbOrTx, userId: string, courseId: string) {
  const [row] = await conn
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
  return row ?? null;
}

/**
 * Creates (or reactivates) an enrollment. Internal: callers are responsible
 * for having established that the learner is entitled to the course, i.e. it
 * is free, a payment was verified, or an administrator granted access.
 */
export async function activateEnrollment(
  tx: Tx,
  notify: Notify,
  input: { userId: string; courseId: string; source: "free" | "purchase" | "admin_grant" },
) {
  const [course] = await tx.select().from(courses).where(eq(courses.id, input.courseId));
  if (!course) throw notFound("The course");
  const existing = await getEnrollment(tx, input.userId, input.courseId);
  if (existing && (existing.status === "active" || existing.status === "completed")) {
    return { enrollment: existing, created: false };
  }
  let enrollment;
  if (existing) {
    [enrollment] = await tx
      .update(enrollments)
      .set({ status: "active", source: input.source })
      .where(eq(enrollments.id, existing.id))
      .returning();
  } else {
    [enrollment] = await tx
      .insert(enrollments)
      .values({ userId: input.userId, courseId: input.courseId, source: input.source })
      .onConflictDoNothing()
      .returning();
    if (!enrollment) {
      // Lost a race with a concurrent request; the other one created it.
      return { enrollment: (await getEnrollment(tx, input.userId, input.courseId))!, created: false };
    }
  }
  await recordActivity(tx, {
    userId: input.userId,
    courseId: course.id,
    type: "enrolled",
    summary: `Enrolled in ${course.title}`,
    link: `/learn/courses/${course.slug}`,
  });
  await awardBadge(tx, input.userId, "first_enrollment");
  await notify({
    userIds: [input.userId],
    category: "enrollment",
    title: `You are enrolled in ${course.title}`,
    body: "You can start learning right away.",
    link: `/learn/courses/${course.slug}`,
  });
  return { enrollment: enrollment!, created: true };
}

/** Self-service enrollment. Only ever succeeds for free, open, published courses. */
export async function enrollInFreeCourse(actor: Actor, courseId: string) {
  assertSignedIn(actor);
  return withNotifications(async (tx, notify) => {
    // Lock the course row so the seat limit cannot be exceeded concurrently.
    const [course] = await tx.select().from(courses).where(eq(courses.id, courseId)).for("update");
    // Unpublished courses are reported as missing so drafts cannot be probed.
    if (!course || course.status !== "published") throw notFound("The course");
    const settings = await getSettings(tx);
    if (!settings.selfEnrollmentEnabled) throw forbidden("Self-enrollment is currently disabled.");
    if (!course.enrollmentOpen) throw conflict("Enrollment for this course is closed.");
    if (course.priceCents > 0) {
      throw forbidden("This is a paid course. Complete the purchase to get access.");
    }
    const existing = await getEnrollment(tx, actor.id, courseId);
    if (existing?.status === "suspended") {
      throw forbidden("Your enrollment in this course has been suspended. Contact support.");
    }
    if (existing && (existing.status === "active" || existing.status === "completed")) {
      return { slug: course.slug, created: false };
    }
    if (course.enrollmentLimit !== null) {
      const [taken] = await tx
        .select({ n: count() })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, courseId), inArray(enrollments.status, ["active", "completed"])));
      if ((taken?.n ?? 0) >= course.enrollmentLimit) throw conflict("This course is full.");
    }
    const result = await activateEnrollment(tx, notify, { userId: actor.id, courseId, source: "free" });
    return { slug: course.slug, created: result.created };
  });
}

// --- Administration --------------------------------------------------------

export async function grantEnrollment(actor: Actor, email: string, courseId: string) {
  assertCan(actor, "enrollment.manage");
  return withNotifications(async (tx, notify) => {
    const [user] = await tx
      .select({ id: users.id, banned: users.banned })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()));
    if (!user) throw invalid("No account uses that email address.", { email: ["Unknown account."] });
    if (user.banned) throw conflict("That account is suspended.");
    const result = await activateEnrollment(tx, notify, { userId: user.id, courseId, source: "admin_grant" });
    await logAudit(tx, {
      actorId: actor.id,
      action: "enrollment.grant",
      entityType: "enrollment",
      entityId: result.enrollment.id,
      metadata: { userId: user.id, courseId },
    });
    return result;
  });
}

export async function setEnrollmentStatus(
  actor: Actor,
  enrollmentId: string,
  status: "active" | "suspended" | "cancelled",
) {
  assertCan(actor, "enrollment.manage");
  await withNotifications(async (tx, notify) => {
    const [row] = await tx.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).for("update");
    if (!row) throw notFound("The enrollment");
    if (row.status === status) return;
    if (row.status === "completed" && status === "active") {
      throw conflict("This enrollment is already completed.");
    }
    await tx.update(enrollments).set({ status }).where(eq(enrollments.id, enrollmentId));
    await logAudit(tx, {
      actorId: actor.id,
      action: `enrollment.${status}`,
      entityType: "enrollment",
      entityId: enrollmentId,
      metadata: { from: row.status },
    });
    if (status === "active") {
      // Requirements may already be met (e.g. reinstated after suspension).
      await evaluateCompletion(tx, notify, row.userId, row.courseId);
    }
  });
}

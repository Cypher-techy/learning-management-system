import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { slugify } from "@/lib/format";
import { db, schema, type DbOrTx } from "../db";
import { AppError, conflict, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, can, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { withNotifications } from "./notifications";
import { recalculateCourseProgress } from "./progress";
import { getSettings } from "./settings";

const { courses, courseInstructors, modules, lessons, lessonResources, enrollments, users } = schema;

export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;

// --- Authorization ---------------------------------------------------------

export async function isOnTeachingTeam(conn: DbOrTx, userId: string, courseId: string) {
  const [row] = await conn
    .select({ role: courseInstructors.role })
    .from(courseInstructors)
    .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.userId, userId)));
  return row ?? null;
}

/**
 * The single gate for every course-management operation: the actor must be
 * an administrator with `course.manage_any`, or hold `course.create` AND be on
 * this course's teaching team. Returns the course.
 */
export async function assertCanManageCourse(
  actor: Actor | null | undefined,
  courseId: string,
  conn: DbOrTx = db,
): Promise<Course> {
  assertSignedIn(actor);
  const [course] = await conn.select().from(courses).where(eq(courses.id, courseId));
  if (!course) throw notFound("The course");
  if (can(actor, "course.manage_any")) return course;
  if (can(actor, "course.create") && (await isOnTeachingTeam(conn, actor.id, courseId))) {
    return course;
  }
  throw forbidden("You are not authorized to manage this course.");
}

export async function canManageCourse(actor: Actor | null | undefined, courseId: string) {
  try {
    await assertCanManageCourse(actor, courseId);
    return true;
  } catch (error) {
    if (error instanceof AppError) return false;
    throw error;
  }
}

/** Course ids the actor teaches (all courses for `course.manage_any`). */
export async function managedCourseIds(actor: Actor): Promise<string[] | "all"> {
  if (can(actor, "course.manage_any")) return "all";
  if (!can(actor, "course.create")) return [];
  const rows = await db
    .select({ id: courseInstructors.courseId })
    .from(courseInstructors)
    .where(eq(courseInstructors.userId, actor.id));
  return rows.map((r) => r.id);
}

// --- Course CRUD -----------------------------------------------------------

async function uniqueSlug(conn: DbOrTx, base: string, excludeId?: string) {
  const root = slugify(base) || "course";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [taken] = await conn
      .select({ id: courses.id })
      .from(courses)
      .where(excludeId ? and(eq(courses.slug, candidate), ne(courses.id, excludeId)) : eq(courses.slug, candidate));
    if (!taken) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}

export const createCourseSchema = z.object({
  title: z.string().trim().min(4, "Give the course a title of at least 4 characters.").max(120),
});

export async function createCourse(actor: Actor, input: z.infer<typeof createCourseSchema>) {
  assertCan(actor, "course.create");
  const data = createCourseSchema.parse(input);
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    const slug = await uniqueSlug(tx, data.title);
    const [course] = await tx
      .insert(courses)
      .values({
        title: data.title,
        slug,
        ownerId: actor.id,
        currency: settings.currency,
        requireAllLessons: settings.defaultRequireAllLessons,
        requireAssessments: settings.defaultRequireAssessments,
        requireAssignments: settings.defaultRequireAssignments,
      })
      .returning();
    await tx.insert(courseInstructors).values({ courseId: course!.id, userId: actor.id, role: "owner" });
    await logAudit(tx, { actorId: actor.id, action: "course.create", entityType: "course", entityId: course!.id });
    return course!;
  });
}

const lines = z
  .array(z.string().trim().min(1).max(200))
  .max(20)
  .default([]);

export const updateCourseSchema = z.object({
  title: z.string().trim().min(4).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and hyphens."),
  shortDescription: z.string().trim().max(200),
  description: z.string().trim().max(10000),
  categoryId: z.string().uuid().nullable(),
  level: z.enum(schema.courseLevel.enumValues),
  language: z.string().trim().min(2).max(40),
  estimatedMinutes: z.number().int().min(0).max(60000),
  objectives: lines,
  prerequisites: lines,
  priceCents: z.number().int().min(0).max(100_000_000),
  enrollmentOpen: z.boolean(),
  enrollmentLimit: z.number().int().min(1).max(1_000_000).nullable(),
  requireAllLessons: z.boolean(),
  requireAssessments: z.boolean(),
  requireAssignments: z.boolean(),
  certificateEnabled: z.boolean(),
  tagIds: z.array(z.string().uuid()).max(10).default([]),
});

export async function updateCourse(actor: Actor, courseId: string, input: z.infer<typeof updateCourseSchema>) {
  const data = updateCourseSchema.parse(input);
  return db.transaction(async (tx) => {
    const course = await assertCanManageCourse(actor, courseId, tx);
    if (course.status === "archived") throw conflict("Restore the course before editing it.");
    if (data.slug !== course.slug) {
      const [taken] = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.slug, data.slug), ne(courses.id, courseId)));
      if (taken) throw invalid("That web address is already used by another course.", { slug: ["Already in use."] });
    }
    const { tagIds, ...fields } = data;
    await tx.update(courses).set(fields).where(eq(courses.id, courseId));
    await tx.delete(schema.courseTags).where(eq(schema.courseTags.courseId, courseId));
    if (tagIds.length > 0) {
      const valid = await tx.select({ id: schema.tags.id }).from(schema.tags).where(inArray(schema.tags.id, tagIds));
      if (valid.length > 0) {
        await tx.insert(schema.courseTags).values(valid.map((t) => ({ courseId, tagId: t.id })));
      }
    }
    return data.slug;
  });
}

export async function setCourseThumbnail(actor: Actor, courseId: string, fileId: string | null) {
  await assertCanManageCourse(actor, courseId);
  if (fileId) {
    const [file] = await db.select().from(schema.files).where(eq(schema.files.id, fileId));
    if (!file || file.purpose !== "course_thumbnail" || file.courseId !== courseId) {
      throw invalid("That image cannot be used as the course thumbnail.");
    }
  }
  await db.update(courses).set({ thumbnailFileId: fileId }).where(eq(courses.id, courseId));
}

// --- Teaching team ---------------------------------------------------------

export async function addCourseInstructor(actor: Actor, courseId: string, email: string) {
  const course = await assertCanManageCourse(actor, courseId);
  if (course.ownerId !== actor.id && !can(actor, "course.manage_any")) {
    throw forbidden("Only the course owner can change the teaching team.");
  }
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  if (!user || user.role === "student") {
    throw invalid("No instructor account uses that email address.");
  }
  await db
    .insert(courseInstructors)
    .values({ courseId, userId: user.id, role: "instructor" })
    .onConflictDoNothing();
  await logAudit(db, {
    actorId: actor.id,
    action: "course.instructor_add",
    entityType: "course",
    entityId: courseId,
    metadata: { userId: user.id },
  });
}

export async function removeCourseInstructor(actor: Actor, courseId: string, userId: string) {
  const course = await assertCanManageCourse(actor, courseId);
  if (course.ownerId !== actor.id && !can(actor, "course.manage_any")) {
    throw forbidden("Only the course owner can change the teaching team.");
  }
  if (userId === course.ownerId) throw conflict("The course owner cannot be removed.");
  await db
    .delete(courseInstructors)
    .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.userId, userId)));
  await logAudit(db, {
    actorId: actor.id,
    action: "course.instructor_remove",
    entityType: "course",
    entityId: courseId,
    metadata: { userId },
  });
}

// --- Publication workflow --------------------------------------------------

export async function publicationIssues(courseId: string, conn: DbOrTx = db): Promise<string[]> {
  const [course] = await conn.select().from(courses).where(eq(courses.id, courseId));
  if (!course) return ["The course no longer exists."];
  const issues: string[] = [];
  if (course.shortDescription.trim().length < 20) issues.push("Add a short description of at least 20 characters.");
  if (course.description.trim().length < 50) issues.push("Add a full description of at least 50 characters.");
  if (!course.categoryId) issues.push("Choose a category.");
  if (course.objectives.length === 0) issues.push("List at least one learning objective.");

  const lessonRows = await conn
    .select({
      id: lessons.id,
      title: lessons.title,
      content: lessons.content,
      videoUrl: lessons.videoUrl,
      videoFileId: lessons.videoFileId,
      resources: sql<number>`(select count(*)::int from ${lessonResources} where ${lessonResources.lessonId} = ${lessons.id})`,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(and(eq(lessons.courseId, courseId), eq(lessons.isPublished, true), eq(modules.isPublished, true)));
  if (lessonRows.length === 0) {
    issues.push("Add at least one published lesson inside a published module.");
  }
  for (const lesson of lessonRows) {
    const empty = lesson.content.trim() === "" && !lesson.videoUrl && !lesson.videoFileId && lesson.resources === 0;
    if (empty) issues.push(`Lesson "${lesson.title}" has no content, video or resources.`);
  }
  return issues;
}

async function notifyAdmins(tx: DbOrTx) {
  const rows = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.banned, false)));
  return rows.map((r) => r.id);
}

/**
 * Publishes directly when the actor may do so, otherwise submits the course
 * for administrator review. Returns the resulting status.
 */
export async function requestPublication(actor: Actor, courseId: string) {
  return withNotifications(async (tx, notify) => {
    const course = await assertCanManageCourse(actor, courseId, tx);
    if (course.status === "published") throw conflict("The course is already published.");
    if (course.status === "archived") throw conflict("Restore the course before publishing it.");
    const issues = await publicationIssues(courseId, tx);
    if (issues.length > 0) {
      throw invalid("The course is not ready to publish.", { publish: issues });
    }
    const settings = await getSettings(tx);
    const direct =
      can(actor, "course.review") || can(actor, "course.publish_direct") || !settings.courseApprovalRequired;
    if (direct) {
      await tx
        .update(courses)
        .set({ status: "published", publishedAt: course.publishedAt ?? new Date(), reviewNote: null })
        .where(eq(courses.id, courseId));
      await logAudit(tx, { actorId: actor.id, action: "course.publish", entityType: "course", entityId: courseId });
      return "published" as const;
    }
    await tx.update(courses).set({ status: "pending_review", reviewNote: null }).where(eq(courses.id, courseId));
    await logAudit(tx, { actorId: actor.id, action: "course.submit_review", entityType: "course", entityId: courseId });
    await notify({
      userIds: await notifyAdmins(tx),
      category: "course_update",
      title: `Course awaiting review: ${course.title}`,
      link: `/admin/courses/${courseId}`,
    });
    return "pending_review" as const;
  });
}

export async function reviewCourse(actor: Actor, courseId: string, decision: "approve" | "reject", note: string) {
  assertCan(actor, "course.review");
  return withNotifications(async (tx, notify) => {
    const [course] = await tx.select().from(courses).where(eq(courses.id, courseId));
    if (!course) throw notFound("The course");
    if (course.status !== "pending_review") throw conflict("This course is not waiting for review.");
    if (decision === "approve") {
      const issues = await publicationIssues(courseId, tx);
      if (issues.length > 0) throw invalid("The course is not ready to publish.", { publish: issues });
      await tx
        .update(courses)
        .set({ status: "published", publishedAt: course.publishedAt ?? new Date(), reviewNote: note || null })
        .where(eq(courses.id, courseId));
    } else {
      if (note.trim().length < 5) throw invalid("Explain what needs to change before the course can be published.");
      await tx.update(courses).set({ status: "draft", reviewNote: note }).where(eq(courses.id, courseId));
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: decision === "approve" ? "course.approve" : "course.reject",
      entityType: "course",
      entityId: courseId,
      metadata: { note },
    });
    await notify({
      userIds: [course.ownerId],
      category: "course_update",
      title: decision === "approve" ? `Your course was approved: ${course.title}` : `Changes requested: ${course.title}`,
      body: note,
      link: `/instructor/courses/${courseId}`,
    });
  });
}

export async function setCourseStatus(
  actor: Actor,
  courseId: string,
  action: "unpublish" | "archive" | "restore" | "withdraw",
) {
  return db.transaction(async (tx) => {
    const course = await assertCanManageCourse(actor, courseId, tx);
    let next: Course["status"];
    if (action === "unpublish") {
      if (course.status !== "published") throw conflict("Only a published course can be unpublished.");
      next = "unpublished";
    } else if (action === "archive") {
      if (course.status === "archived") throw conflict("The course is already archived.");
      next = "archived";
    } else if (action === "withdraw") {
      if (course.status !== "pending_review") throw conflict("The course is not waiting for review.");
      next = "draft";
    } else {
      if (course.status !== "archived") throw conflict("Only an archived course can be restored.");
      next = "draft";
    }
    await tx.update(courses).set({ status: next }).where(eq(courses.id, courseId));
    await logAudit(tx, { actorId: actor.id, action: `course.${action}`, entityType: "course", entityId: courseId });
    return next;
  });
}

/** Permanent removal. Only possible while nobody has ever enrolled. */
export async function deleteCourse(actor: Actor, courseId: string) {
  assertCan(actor, "course.manage_any");
  await db.transaction(async (tx) => {
    const [course] = await tx.select().from(courses).where(eq(courses.id, courseId));
    if (!course) throw notFound("The course");
    const [enrolled] = await tx.select({ n: count() }).from(enrollments).where(eq(enrollments.courseId, courseId));
    if ((enrolled?.n ?? 0) > 0) {
      throw conflict("This course has enrollment records. Archive it instead of deleting it.");
    }
    await tx.delete(courses).where(eq(courses.id, courseId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "course.delete",
      entityType: "course",
      entityId: courseId,
      metadata: { title: course.title },
    });
  });
}

// --- Modules ---------------------------------------------------------------

export const moduleSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(""),
  isPublished: z.boolean().default(true),
});

export async function createModule(actor: Actor, courseId: string, input: z.infer<typeof moduleSchema>) {
  const data = moduleSchema.parse(input);
  await assertCanManageCourse(actor, courseId);
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${modules.position}), -1)::int` })
    .from(modules)
    .where(eq(modules.courseId, courseId));
  const [row] = await db
    .insert(modules)
    .values({ ...data, courseId, position: (last?.max ?? -1) + 1 })
    .returning();
  return row!;
}

async function loadModule(conn: DbOrTx, moduleId: string) {
  const [row] = await conn.select().from(modules).where(eq(modules.id, moduleId));
  if (!row) throw notFound("The module");
  return row;
}

export async function updateModule(actor: Actor, moduleId: string, input: z.infer<typeof moduleSchema>) {
  const data = moduleSchema.parse(input);
  const mod = await loadModule(db, moduleId);
  await assertCanManageCourse(actor, mod.courseId);
  await db.update(modules).set(data).where(eq(modules.id, moduleId));
  if (data.isPublished !== mod.isPublished) await recalculateCourseProgress(mod.courseId);
  return mod.courseId;
}

export async function deleteModule(actor: Actor, moduleId: string) {
  const mod = await loadModule(db, moduleId);
  await assertCanManageCourse(actor, mod.courseId);
  await db.delete(modules).where(eq(modules.id, moduleId));
  await recalculateCourseProgress(mod.courseId);
  return mod.courseId;
}

export async function reorderModules(actor: Actor, courseId: string, orderedIds: string[]) {
  await assertCanManageCourse(actor, courseId);
  const ids = z.array(z.string().uuid()).max(500).parse(orderedIds);
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: modules.id }).from(modules).where(eq(modules.courseId, courseId));
    const known = new Set(existing.map((m) => m.id));
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
      throw invalid("The module list changed. Reload the page and try again.");
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(modules).set({ position }).where(eq(modules.id, id));
    }
  });
}

// --- Lessons ---------------------------------------------------------------

const videoUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Enter a full https:// video URL.");

export const lessonSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).default(""),
  content: z.string().max(100_000).default(""),
  videoUrl: videoUrl.default(""),
  estimatedMinutes: z.number().int().min(0).max(6000).default(0),
  isPreview: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

async function loadLesson(conn: DbOrTx, lessonId: string) {
  const [row] = await conn.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!row) throw notFound("The lesson");
  return row;
}

async function activeLearnerIds(conn: DbOrTx, courseId: string) {
  const rows = await conn
    .select({ id: enrollments.userId })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), inArray(enrollments.status, ["active", "completed"])));
  return rows.map((r) => r.id);
}

export async function createLesson(actor: Actor, moduleId: string, input: z.infer<typeof lessonSchema>) {
  const data = lessonSchema.parse(input);
  const lesson = await withNotifications(async (tx, notify) => {
    const mod = await loadModule(tx, moduleId);
    const course = await assertCanManageCourse(actor, mod.courseId, tx);
    const [last] = await tx
      .select({ max: sql<number>`coalesce(max(${lessons.position}), -1)::int` })
      .from(lessons)
      .where(eq(lessons.moduleId, moduleId));
    const [row] = await tx
      .insert(lessons)
      .values({
        ...data,
        videoUrl: data.videoUrl || null,
        moduleId,
        courseId: mod.courseId,
        position: (last?.max ?? -1) + 1,
      })
      .returning();
    if (course.status === "published" && data.isPublished && mod.isPublished) {
      await notify({
        userIds: await activeLearnerIds(tx, course.id),
        category: "course_update",
        title: `New lesson in ${course.title}`,
        body: data.title,
        link: `/learn/courses/${course.slug}/lessons/${row!.id}`,
      });
    }
    return row!;
  });
  await recalculateCourseProgress(lesson.courseId);
  return lesson;
}

export async function updateLesson(actor: Actor, lessonId: string, input: z.infer<typeof lessonSchema>) {
  const data = lessonSchema.parse(input);
  const lesson = await loadLesson(db, lessonId);
  await assertCanManageCourse(actor, lesson.courseId);
  await db
    .update(lessons)
    .set({ ...data, videoUrl: data.videoUrl || null })
    .where(eq(lessons.id, lessonId));
  if (data.isPublished !== lesson.isPublished) await recalculateCourseProgress(lesson.courseId);
  return lesson.courseId;
}

export async function setLessonVideoFile(actor: Actor, lessonId: string, fileId: string | null) {
  const lesson = await loadLesson(db, lessonId);
  await assertCanManageCourse(actor, lesson.courseId);
  if (fileId) {
    const [file] = await db.select().from(schema.files).where(eq(schema.files.id, fileId));
    if (!file || file.purpose !== "lesson_video" || file.courseId !== lesson.courseId) {
      throw invalid("That file cannot be used as the lesson video.");
    }
  }
  await db.update(lessons).set({ videoFileId: fileId }).where(eq(lessons.id, lessonId));
  return lesson.courseId;
}

export async function deleteLesson(actor: Actor, lessonId: string) {
  const lesson = await loadLesson(db, lessonId);
  await assertCanManageCourse(actor, lesson.courseId);
  await db.delete(lessons).where(eq(lessons.id, lessonId));
  await recalculateCourseProgress(lesson.courseId);
  return lesson.courseId;
}

/**
 * Persists the order of lessons inside one module. Lessons dragged in from
 * another module of the same course are moved.
 */
export async function reorderLessons(actor: Actor, moduleId: string, orderedIds: string[]) {
  const ids = z.array(z.string().uuid()).max(1000).parse(orderedIds);
  const mod = await loadModule(db, moduleId);
  await assertCanManageCourse(actor, mod.courseId);
  await db.transaction(async (tx) => {
    if (ids.length > 0) {
      const found = await tx
        .select({ id: lessons.id })
        .from(lessons)
        .where(and(eq(lessons.courseId, mod.courseId), inArray(lessons.id, ids)));
      if (found.length !== new Set(ids).size) {
        throw invalid("The lesson list changed. Reload the page and try again.");
      }
    }
    for (const [position, id] of ids.entries()) {
      await tx.update(lessons).set({ position, moduleId }).where(eq(lessons.id, id));
    }
  });
  return mod.courseId;
}

// --- Lesson resources ------------------------------------------------------

export const linkResourceSchema = z.object({
  title: z.string().trim().min(2).max(160),
  url: z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/i, "Enter a full https:// link."),
});

export async function addLinkResource(actor: Actor, lessonId: string, input: z.infer<typeof linkResourceSchema>) {
  const data = linkResourceSchema.parse(input);
  const lesson = await loadLesson(db, lessonId);
  await assertCanManageCourse(actor, lesson.courseId);
  await db.insert(lessonResources).values({ lessonId, kind: "link", title: data.title, url: data.url });
  return lesson.courseId;
}

export async function addFileResource(actor: Actor, lessonId: string, fileId: string, title: string) {
  const lesson = await loadLesson(db, lessonId);
  await assertCanManageCourse(actor, lesson.courseId);
  const [file] = await db.select().from(schema.files).where(eq(schema.files.id, fileId));
  if (!file || file.purpose !== "lesson_resource" || file.courseId !== lesson.courseId) {
    throw invalid("That file cannot be attached to this lesson.");
  }
  await db.insert(lessonResources).values({
    lessonId,
    kind: "file",
    fileId,
    title: title.trim().slice(0, 160) || file.originalName,
  });
  return lesson.courseId;
}

export async function deleteResource(actor: Actor, resourceId: string) {
  const [resource] = await db
    .select({ id: lessonResources.id, courseId: lessons.courseId })
    .from(lessonResources)
    .innerJoin(lessons, eq(lessons.id, lessonResources.lessonId))
    .where(eq(lessonResources.id, resourceId));
  if (!resource) throw notFound("The resource");
  await assertCanManageCourse(actor, resource.courseId);
  await db.delete(lessonResources).where(eq(lessonResources.id, resourceId));
  return resource.courseId;
}

// --- Reads for the editor --------------------------------------------------

export async function getCurriculum(courseId: string, conn: DbOrTx = db) {
  const [moduleRows, lessonRows] = await Promise.all([
    conn.select().from(modules).where(eq(modules.courseId, courseId)).orderBy(asc(modules.position), asc(modules.createdAt)),
    conn.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.position), asc(lessons.createdAt)),
  ]);
  return moduleRows.map((m) => ({ ...m, lessons: lessonRows.filter((l) => l.moduleId === m.id) }));
}

export async function getCourseTeam(courseId: string) {
  return db
    .select({ userId: users.id, name: users.name, email: users.email, role: courseInstructors.role })
    .from(courseInstructors)
    .innerJoin(users, eq(users.id, courseInstructors.userId))
    .where(eq(courseInstructors.courseId, courseId))
    .orderBy(asc(courseInstructors.createdAt));
}

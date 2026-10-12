import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema, type DbOrTx, type Tx } from "../db";
import { forbidden, notFound } from "../errors";
import { assertSignedIn, can, type Actor } from "../permissions";
import { issueCertificate } from "./certificates";
import { withNotifications, type Notify } from "./notifications";

const {
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  assessments,
  assessmentAttempts,
  assignments,
  assignmentSubmissions,
  courseInstructors,
} = schema;

export type Enrollment = typeof enrollments.$inferSelect;

/** Statuses in which an enrolled learner may open course material. */
export const LEARNER_VISIBLE_COURSE_STATUSES = ["published", "unpublished"] as const;

export async function awardBadge(conn: DbOrTx, userId: string, badge: string) {
  await conn.insert(schema.userBadges).values({ userId, badge }).onConflictDoNothing();
}

export async function recordActivity(
  conn: DbOrTx,
  event: { userId: string; courseId?: string | null; type: string; summary: string; link?: string },
) {
  await conn.insert(schema.activityEvents).values({
    userId: event.userId,
    courseId: event.courseId ?? null,
    type: event.type,
    summary: event.summary,
    link: event.link ?? null,
  });
}

/** Lessons that count towards progress: published, inside a published module. */
export async function publishedLessons(conn: DbOrTx, courseId: string) {
  return conn
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      title: lessons.title,
      estimatedMinutes: lessons.estimatedMinutes,
      isPreview: lessons.isPreview,
      position: lessons.position,
      modulePosition: modules.position,
    })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(and(eq(lessons.courseId, courseId), eq(lessons.isPublished, true), eq(modules.isPublished, true)))
    .orderBy(asc(modules.position), asc(modules.createdAt), asc(lessons.position), asc(lessons.createdAt));
}

/**
 * Progress is the share of countable lessons the learner has explicitly
 * completed. Opening a lesson never counts as completing it.
 */
export async function computeProgress(conn: DbOrTx, userId: string, courseId: string) {
  const lessonRows = await publishedLessons(conn, courseId);
  const ids = lessonRows.map((l) => l.id);
  const done =
    ids.length === 0
      ? []
      : await conn
          .select({ lessonId: lessonProgress.lessonId })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.userId, userId),
              inArray(lessonProgress.lessonId, ids),
              isNotNull(lessonProgress.completedAt),
            ),
          );
  const total = ids.length;
  const completed = done.length;
  const percent = total === 0 ? 0 : Math.floor((completed / total) * 100);
  return { total, completed, percent, completedIds: new Set(done.map((d) => d.lessonId)), lessons: lessonRows };
}

/** Refreshes the cached percentage on every enrollment after curriculum changes. */
export async function recalculateCourseProgress(courseId: string, conn: DbOrTx = db) {
  await conn.execute(sql`
    update enrollments e set progress_percent = coalesce((
      select case when count(l.id) = 0 then 0
        else floor(100.0 * count(lp.lesson_id) filter (where lp.completed_at is not null) / count(l.id)) end
      from lessons l
      join modules m on m.id = l.module_id
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
      where l.course_id = e.course_id and l.is_published and m.is_published
    ), 0)
    where e.course_id = ${courseId}
  `);
}

export type CompletionStatus = {
  lessons: { required: boolean; done: number; total: number; met: boolean };
  assessments: { required: boolean; passed: number; total: number; met: boolean; averagePercent: number | null };
  assignments: { required: boolean; passed: number; total: number; met: boolean };
  met: boolean;
};

/** Evaluates the course's configured completion rules for one learner. */
export async function completionStatus(conn: DbOrTx, userId: string, courseId: string): Promise<CompletionStatus> {
  const [course] = await conn.select().from(courses).where(eq(courses.id, courseId));
  if (!course) throw notFound("The course");
  const progress = await computeProgress(conn, userId, courseId);

  const requiredAssessments = await conn
    .select({ id: assessments.id })
    .from(assessments)
    .where(
      and(
        eq(assessments.courseId, courseId),
        eq(assessments.isPublished, true),
        eq(assessments.requiredForCompletion, true),
      ),
    );
  let passedAssessments = 0;
  const bestPercents: number[] = [];
  if (requiredAssessments.length > 0) {
    const attempts = await conn
      .select({
        assessmentId: assessmentAttempts.assessmentId,
        passed: assessmentAttempts.passed,
        percent: assessmentAttempts.percent,
      })
      .from(assessmentAttempts)
      .where(
        and(
          eq(assessmentAttempts.userId, userId),
          eq(assessmentAttempts.status, "graded"),
          // Unreleased results must not influence anything the learner can see.
          isNotNull(assessmentAttempts.releasedAt),
          inArray(assessmentAttempts.assessmentId, requiredAssessments.map((a) => a.id)),
        ),
      );
    for (const a of requiredAssessments) {
      const mine = attempts.filter((t) => t.assessmentId === a.id);
      if (mine.some((t) => t.passed)) passedAssessments += 1;
      if (mine.length > 0) bestPercents.push(Math.max(...mine.map((t) => t.percent ?? 0)));
    }
  }

  const requiredAssignments = await conn
    .select({ id: assignments.id, maxMarks: assignments.maxMarks, passMarkPercent: assignments.passMarkPercent })
    .from(assignments)
    .where(
      and(
        eq(assignments.courseId, courseId),
        eq(assignments.isPublished, true),
        eq(assignments.requiredForCompletion, true),
      ),
    );
  let passedAssignments = 0;
  if (requiredAssignments.length > 0) {
    const subs = await conn
      .select({ assignmentId: assignmentSubmissions.assignmentId, marks: assignmentSubmissions.marks })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.userId, userId),
          eq(assignmentSubmissions.status, "graded"),
          isNotNull(assignmentSubmissions.releasedAt),
          inArray(assignmentSubmissions.assignmentId, requiredAssignments.map((a) => a.id)),
        ),
      );
    for (const a of requiredAssignments) {
      const sub = subs.find((s) => s.assignmentId === a.id);
      const percent = sub?.marks != null && a.maxMarks > 0 ? (sub.marks / a.maxMarks) * 100 : -1;
      if (percent >= a.passMarkPercent) passedAssignments += 1;
    }
  }

  const lessonsMet = !course.requireAllLessons || (progress.total > 0 && progress.completed === progress.total);
  const assessmentsMet = !course.requireAssessments || passedAssessments === requiredAssessments.length;
  const assignmentsMet = !course.requireAssignments || passedAssignments === requiredAssignments.length;
  return {
    lessons: { required: course.requireAllLessons, done: progress.completed, total: progress.total, met: lessonsMet },
    assessments: {
      required: course.requireAssessments,
      passed: passedAssessments,
      total: requiredAssessments.length,
      met: assessmentsMet,
      averagePercent:
        bestPercents.length > 0 ? bestPercents.reduce((a, b) => a + b, 0) / bestPercents.length : null,
    },
    assignments: {
      required: course.requireAssignments,
      passed: passedAssignments,
      total: requiredAssignments.length,
      met: assignmentsMet,
    },
    // A course with nothing to complete can never be "completed".
    met: progress.total > 0 && lessonsMet && assessmentsMet && assignmentsMet,
  };
}

/**
 * Marks the enrollment completed and issues the certificate once every
 * configured requirement is met. Safe to call repeatedly.
 */
export async function evaluateCompletion(tx: Tx, notify: Notify, userId: string, courseId: string) {
  const [enrollment] = await tx
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .for("update");
  if (!enrollment || enrollment.status !== "active") return false;
  const status = await completionStatus(tx, userId, courseId);
  if (!status.met) return false;

  const [course] = await tx.select().from(courses).where(eq(courses.id, courseId));
  await tx
    .update(enrollments)
    .set({ status: "completed", completedAt: new Date(), progressPercent: 100 })
    .where(eq(enrollments.id, enrollment.id));
  await recordActivity(tx, {
    userId,
    courseId,
    type: "course_completed",
    summary: `Completed ${course!.title}`,
    link: `/learn/courses/${course!.slug}`,
  });
  await awardBadge(tx, userId, "course_completed");
  await notify({
    userIds: [userId],
    category: "certificate",
    title: `You completed ${course!.title}`,
    body: course!.certificateEnabled ? "Your certificate is ready to download." : "Well done.",
    link: course!.certificateEnabled ? "/learn/certificates" : `/learn/courses/${course!.slug}`,
  });
  if (course!.certificateEnabled) {
    await issueCertificate(tx, { ...enrollment, status: "completed" }, status.assessments.averagePercent);
  }
  return true;
}

// --- Learner access --------------------------------------------------------

export type LessonAccess = {
  lesson: typeof lessons.$inferSelect;
  course: typeof courses.$inferSelect;
  enrollment: Enrollment | null;
  /** True for the teaching team and administrators (preview mode). */
  staff: boolean;
};

/**
 * Decides whether the actor may open a lesson. Learners need an active or
 * completed enrollment in a course that is still available; the teaching team
 * and administrators may preview anything in their courses.
 */
export async function getLessonAccess(actor: Actor, lessonId: string, conn: DbOrTx = db): Promise<LessonAccess> {
  assertSignedIn(actor);
  const [row] = await conn
    .select({ lesson: lessons, course: courses, modulePublished: modules.isPublished })
    .from(lessons)
    .innerJoin(courses, eq(courses.id, lessons.courseId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(lessons.id, lessonId));
  if (!row) throw notFound("The lesson");

  let staff = can(actor, "course.manage_any");
  if (!staff && can(actor, "course.create")) {
    const [member] = await conn
      .select({ userId: courseInstructors.userId })
      .from(courseInstructors)
      .where(and(eq(courseInstructors.courseId, row.course.id), eq(courseInstructors.userId, actor.id)));
    staff = !!member;
  }
  const [enrollment] = await conn
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, actor.id), eq(enrollments.courseId, row.course.id)));

  if (staff) return { lesson: row.lesson, course: row.course, enrollment: enrollment ?? null, staff };

  const available =
    (LEARNER_VISIBLE_COURSE_STATUSES as readonly string[]).includes(row.course.status) &&
    row.lesson.isPublished &&
    row.modulePublished;
  // Unavailable material is reported as missing, not as forbidden, so that
  // drafts cannot be probed for.
  if (!available) throw notFound("The lesson");
  const enrolled = enrollment && (enrollment.status === "active" || enrollment.status === "completed");
  if (!enrolled) throw forbidden("Enroll in this course to open its lessons.");
  return { lesson: row.lesson, course: row.course, enrollment: enrollment!, staff: false };
}

/** Records that a lesson was opened (for "continue learning"). Not completion. */
export async function recordLessonVisit(actor: Actor, lessonId: string) {
  const access = await getLessonAccess(actor, lessonId);
  if (!access.enrollment || access.staff) return;
  const now = new Date();
  await db
    .insert(lessonProgress)
    .values({ userId: actor.id, lessonId, courseId: access.course.id, lastAccessedAt: now })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { lastAccessedAt: now },
    });
  await db
    .update(enrollments)
    .set({ lastLessonId: lessonId, lastAccessedAt: now })
    .where(eq(enrollments.id, access.enrollment.id));
}

export async function saveVideoPosition(actor: Actor, lessonId: string, seconds: number) {
  const access = await getLessonAccess(actor, lessonId);
  if (!access.enrollment || access.staff) return;
  const position = Math.max(0, Math.min(Math.floor(seconds), 60 * 60 * 24));
  await db
    .insert(lessonProgress)
    .values({ userId: actor.id, lessonId, courseId: access.course.id, videoPositionSeconds: position })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { videoPositionSeconds: position, lastAccessedAt: new Date() },
    });
}

export async function setLessonCompleted(actor: Actor, lessonId: string, completed: boolean) {
  return withNotifications(async (tx, notify) => {
    const access = await getLessonAccess(actor, lessonId, tx);
    if (access.staff && !access.enrollment) {
      throw forbidden("Preview mode does not record progress. Enroll to track completion.");
    }
    const enrollment = access.enrollment!;
    if (enrollment.status !== "active" && enrollment.status !== "completed") {
      throw forbidden("Your enrollment in this course is not active.");
    }
    const now = new Date();
    await tx
      .insert(lessonProgress)
      .values({
        userId: actor.id,
        lessonId,
        courseId: access.course.id,
        completedAt: completed ? now : null,
        lastAccessedAt: now,
      })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: { completedAt: completed ? now : null, lastAccessedAt: now },
      });
    const progress = await computeProgress(tx, actor.id, access.course.id);
    await tx
      .update(enrollments)
      .set({ progressPercent: progress.percent, lastLessonId: lessonId, lastAccessedAt: now })
      .where(eq(enrollments.id, enrollment.id));
    let courseCompleted = enrollment.status === "completed";
    if (completed) {
      await recordActivity(tx, {
        userId: actor.id,
        courseId: access.course.id,
        type: "lesson_completed",
        summary: `Completed lesson: ${access.lesson.title}`,
        link: `/learn/courses/${access.course.slug}/lessons/${lessonId}`,
      });
      await awardBadge(tx, actor.id, "first_lesson");
      if (!courseCompleted) {
        courseCompleted = await evaluateCompletion(tx, notify, actor.id, access.course.id);
      }
    }
    return { percent: courseCompleted ? 100 : progress.percent, courseCompleted, slug: access.course.slug };
  });
}

// --- Bookmarks and notes ---------------------------------------------------

export async function toggleBookmark(actor: Actor, lessonId: string) {
  const access = await getLessonAccess(actor, lessonId);
  const where = and(eq(schema.bookmarks.userId, actor.id), eq(schema.bookmarks.lessonId, lessonId));
  const [existing] = await db.select().from(schema.bookmarks).where(where);
  if (existing) {
    await db.delete(schema.bookmarks).where(where);
    return { bookmarked: false, slug: access.course.slug };
  }
  await db.insert(schema.bookmarks).values({ userId: actor.id, lessonId });
  return { bookmarked: true, slug: access.course.slug };
}

export async function saveNote(actor: Actor, lessonId: string, content: string) {
  await getLessonAccess(actor, lessonId);
  const text = content.slice(0, 20_000);
  const where = and(eq(schema.lessonNotes.userId, actor.id), eq(schema.lessonNotes.lessonId, lessonId));
  if (text.trim() === "") {
    await db.delete(schema.lessonNotes).where(where);
    return;
  }
  await db
    .insert(schema.lessonNotes)
    .values({ userId: actor.id, lessonId, content: text })
    .onConflictDoUpdate({
      target: [schema.lessonNotes.userId, schema.lessonNotes.lessonId],
      set: { content: text, updatedAt: new Date() },
    });
}

import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { notFound } from "../errors";
import type { Actor } from "../permissions";
import { certificateForEnrollment } from "../services/certificates";
import { announcementsForLearner, upcomingLiveSessions } from "../services/community";
import { completionStatus, computeProgress, getLessonAccess } from "../services/progress";
import type { CourseCardData } from "./catalog";

const {
  courses,
  categories,
  users,
  profiles,
  modules,
  lessons,
  lessonResources,
  enrollments,
  lessonProgress,
  assessments,
  assessmentAttempts,
  assignments,
  assignmentSubmissions,
  bookmarks,
  lessonNotes,
  activityEvents,
  certificates,
  courseInstructors,
  announcements,
} = schema;

const ACTIVE = ["active", "completed"] as const;

const lessonCount = sql<number>`(select count(*)::int from ${lessons} join ${modules} on ${modules.id} = ${lessons.moduleId} where ${lessons.courseId} = ${courses.id} and ${lessons.isPublished} and ${modules.isPublished})`;

/** The learner's own enrollments, with the data a course card needs. */
export async function myEnrollments(userId: string) {
  const rows = await db
    .select({
      enrollment: enrollments,
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      shortDescription: courses.shortDescription,
      thumbnailFileId: courses.thumbnailFileId,
      level: courses.level,
      language: courses.language,
      estimatedMinutes: courses.estimatedMinutes,
      priceCents: courses.priceCents,
      currency: courses.currency,
      publishedAt: courses.publishedAt,
      status: courses.status,
      categoryName: categories.name,
      instructorName: users.name,
      lessonCount,
      lastLessonTitle: lessons.title,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(users, eq(users.id, courses.ownerId))
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .leftJoin(lessons, eq(lessons.id, enrollments.lastLessonId))
    .where(and(eq(enrollments.userId, userId), inArray(enrollments.status, [...ACTIVE])))
    .orderBy(desc(sql`coalesce(${enrollments.lastAccessedAt}, ${enrollments.enrolledAt})`));
  return rows
    // Archived or withdrawn courses are no longer available to learners.
    .filter((r) => r.status === "published" || r.status === "unpublished")
    .map(({ enrollment, lastLessonTitle, ...course }) => ({
      enrollment,
      lastLessonTitle,
      course: { ...course, enrolledCount: 0 } as CourseCardData,
    }));
}

export type Deadline = {
  kind: "quiz" | "exam" | "assignment";
  id: string;
  title: string;
  courseTitle: string;
  dueAt: Date;
  href: string;
};

/** Upcoming assessment closings and assignment due dates the learner still has to act on. */
export async function upcomingDeadlines(userId: string, limit = 10): Promise<Deadline[]> {
  const mine = db
    .select({ id: enrollments.courseId })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.status, "active")));
  const now = new Date();
  const [assessmentRows, assignmentRows] = await Promise.all([
    db
      .select({
        id: assessments.id,
        kind: assessments.kind,
        title: assessments.title,
        endsAt: assessments.endsAt,
        courseTitle: courses.title,
        done: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.userId} = ${userId} and ${assessmentAttempts.status} <> 'in_progress')`,
      })
      .from(assessments)
      .innerJoin(courses, eq(courses.id, assessments.courseId))
      .where(
        and(
          inArray(assessments.courseId, mine),
          eq(assessments.isPublished, true),
          inArray(courses.status, ["published", "unpublished"]),
          isNotNull(assessments.endsAt),
          gte(assessments.endsAt, now),
        ),
      )
      .orderBy(asc(assessments.endsAt))
      .limit(limit * 2),
    db
      .select({
        id: assignments.id,
        title: assignments.title,
        dueAt: assignments.dueAt,
        courseTitle: courses.title,
        done: sql<number>`(select count(*)::int from ${assignmentSubmissions} where ${assignmentSubmissions.assignmentId} = ${assignments.id} and ${assignmentSubmissions.userId} = ${userId} and ${assignmentSubmissions.status} <> 'draft')`,
      })
      .from(assignments)
      .innerJoin(courses, eq(courses.id, assignments.courseId))
      .where(
        and(
          inArray(assignments.courseId, mine),
          eq(assignments.isPublished, true),
          inArray(courses.status, ["published", "unpublished"]),
          isNotNull(assignments.dueAt),
          gte(assignments.dueAt, now),
        ),
      )
      .orderBy(asc(assignments.dueAt))
      .limit(limit * 2),
  ]);
  const items: Deadline[] = [
    ...assessmentRows
      .filter((r) => r.done === 0)
      .map((r) => ({ kind: r.kind, id: r.id, title: r.title, courseTitle: r.courseTitle, dueAt: r.endsAt!, href: `/learn/assessments/${r.id}` })),
    ...assignmentRows
      .filter((r) => r.done === 0)
      .map((r) => ({
        kind: "assignment" as const,
        id: r.id,
        title: r.title,
        courseTitle: r.courseTitle,
        dueAt: r.dueAt!,
        href: `/learn/assignments/${r.id}`,
      })),
  ];
  return items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()).slice(0, limit);
}

export async function learnerDashboard(actor: Actor) {
  const [enrolled, deadlines, news, activity, certs, live, badges] = await Promise.all([
    myEnrollments(actor.id),
    upcomingDeadlines(actor.id, 6),
    announcementsForLearner(actor.id, 4),
    db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.userId, actor.id))
      .orderBy(desc(activityEvents.createdAt))
      .limit(6),
    db.select().from(certificates).where(eq(certificates.userId, actor.id)).orderBy(desc(certificates.issuedAt)).limit(3),
    upcomingLiveSessions(actor.id, 3),
    db.select().from(schema.userBadges).where(eq(schema.userBadges.userId, actor.id)),
  ]);
  const inProgress = enrolled.filter((e) => e.enrollment.status === "active");
  const completed = enrolled.filter((e) => e.enrollment.status === "completed");
  const average =
    enrolled.length === 0
      ? 0
      : Math.round(
          enrolled.reduce((sum, e) => sum + (e.enrollment.status === "completed" ? 100 : e.enrollment.progressPercent), 0) /
            enrolled.length,
        );
  return {
    enrolled,
    inProgress,
    completed,
    average,
    continueWith: inProgress[0] ?? null,
    deadlines,
    news,
    activity,
    certificates: certs,
    live,
    badges,
  };
}

/** Everything the course home and the lesson player need, for an enrolled learner or course staff. */
export async function courseWorkspace(actor: Actor, slug: string) {
  const [course] = await db.select().from(courses).where(eq(courses.slug, slug));
  if (!course) throw notFound("The course");
  // Authorize through any lesson of the course; an empty course is staff-only.
  const [anyLesson] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.courseId, course.id)).limit(1);
  let staff = false;
  let enrollment: typeof enrollments.$inferSelect | null = null;
  if (anyLesson) {
    // Probe with a published lesson when one exists so learners are not rejected by a draft lesson.
    const [published] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(lessons.courseId, course.id), eq(lessons.isPublished, true), eq(modules.isPublished, true)))
      .limit(1);
    const access = await getLessonAccess(actor, (published ?? anyLesson).id);
    staff = access.staff;
    enrollment = access.enrollment;
  } else {
    const [member] = await db
      .select({ id: courseInstructors.userId })
      .from(courseInstructors)
      .where(and(eq(courseInstructors.courseId, course.id), eq(courseInstructors.userId, actor.id)));
    if (!member && !actor.permissions.has("course.manage_any")) throw notFound("The course");
    staff = true;
  }

  const [moduleRows, progress, assessmentRows, assignmentRows, team, news, completion, certificate] = await Promise.all([
    db
      .select({ id: modules.id, title: modules.title, description: modules.description })
      .from(modules)
      .where(and(eq(modules.courseId, course.id), eq(modules.isPublished, true)))
      .orderBy(asc(modules.position), asc(modules.createdAt)),
    computeProgress(db, actor.id, course.id),
    db
      .select({
        id: assessments.id,
        kind: assessments.kind,
        title: assessments.title,
        lessonId: assessments.lessonId,
        endsAt: assessments.endsAt,
        startsAt: assessments.startsAt,
        requiredForCompletion: assessments.requiredForCompletion,
        attempts: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.userId} = ${actor.id})`,
        passed: sql<boolean>`exists(select 1 from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.userId} = ${actor.id} and ${assessmentAttempts.passed} and ${assessmentAttempts.releasedAt} is not null)`,
      })
      .from(assessments)
      .where(and(eq(assessments.courseId, course.id), eq(assessments.isPublished, true)))
      .orderBy(asc(assessments.createdAt)),
    db
      .select({
        id: assignments.id,
        title: assignments.title,
        lessonId: assignments.lessonId,
        dueAt: assignments.dueAt,
        requiredForCompletion: assignments.requiredForCompletion,
        status: sql<string | null>`(select ${assignmentSubmissions.status} from ${assignmentSubmissions} where ${assignmentSubmissions.assignmentId} = ${assignments.id} and ${assignmentSubmissions.userId} = ${actor.id})`,
        released: sql<boolean>`exists(select 1 from ${assignmentSubmissions} where ${assignmentSubmissions.assignmentId} = ${assignments.id} and ${assignmentSubmissions.userId} = ${actor.id} and ${assignmentSubmissions.releasedAt} is not null)`,
      })
      .from(assignments)
      .where(and(eq(assignments.courseId, course.id), eq(assignments.isPublished, true)))
      .orderBy(asc(assignments.createdAt)),
    db
      .select({ name: users.name, headline: profiles.headline })
      .from(courseInstructors)
      .innerJoin(users, eq(users.id, courseInstructors.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(courseInstructors.courseId, course.id))
      .orderBy(asc(courseInstructors.createdAt)),
    db
      .select()
      .from(announcements)
      .where(eq(announcements.courseId, course.id))
      .orderBy(desc(announcements.createdAt))
      .limit(5),
    completionStatus(db, actor.id, course.id),
    certificateForEnrollment(db, actor.id, course.id),
  ]);

  const flat = progress.lessons;
  return {
    course,
    staff,
    enrollment,
    modules: moduleRows.map((m) => ({
      ...m,
      lessons: flat.filter((l) => l.moduleId === m.id).map((l) => ({ ...l, completed: progress.completedIds.has(l.id) })),
    })),
    lessonOrder: flat.map((l) => l.id),
    progress: { total: progress.total, completed: progress.completed, percent: progress.percent },
    assessments: assessmentRows,
    // A graded-but-unreleased submission looks like "submitted" to the learner.
    assignments: assignmentRows.map((a) => ({ ...a, status: a.status === "graded" && !a.released ? "submitted" : a.status })),
    team,
    announcements: news,
    completion,
    certificate,
  };
}

/** One lesson with the learner's private state (bookmark, note, video position). */
export async function lessonView(actor: Actor, lessonId: string) {
  const access = await getLessonAccess(actor, lessonId);
  const [resources, [mark], [note], [state]] = await Promise.all([
    db
      .select()
      .from(lessonResources)
      .where(eq(lessonResources.lessonId, lessonId))
      .orderBy(asc(lessonResources.position), asc(lessonResources.createdAt)),
    db.select().from(bookmarks).where(and(eq(bookmarks.userId, actor.id), eq(bookmarks.lessonId, lessonId))),
    db.select().from(lessonNotes).where(and(eq(lessonNotes.userId, actor.id), eq(lessonNotes.lessonId, lessonId))),
    db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, actor.id), eq(lessonProgress.lessonId, lessonId))),
  ]);
  return {
    ...access,
    resources,
    bookmarked: !!mark,
    note: note?.content ?? "",
    completed: !!state?.completedAt,
    videoPosition: state?.videoPositionSeconds ?? 0,
  };
}

export async function myGrades(userId: string) {
  const [attempts, submissions] = await Promise.all([
    db
      .select({
        id: assessmentAttempts.id,
        attemptNumber: assessmentAttempts.attemptNumber,
        status: assessmentAttempts.status,
        submittedAt: assessmentAttempts.submittedAt,
        releasedAt: assessmentAttempts.releasedAt,
        score: assessmentAttempts.score,
        maxScore: assessmentAttempts.maxScore,
        percent: assessmentAttempts.percent,
        passed: assessmentAttempts.passed,
        title: assessments.title,
        kind: assessments.kind,
        courseTitle: courses.title,
      })
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .innerJoin(courses, eq(courses.id, assessments.courseId))
      .where(and(eq(assessmentAttempts.userId, userId), inArray(assessmentAttempts.status, ["submitted", "graded"])))
      .orderBy(desc(assessmentAttempts.submittedAt))
      .limit(200),
    db
      .select({
        id: assignmentSubmissions.id,
        assignmentId: assignments.id,
        status: assignmentSubmissions.status,
        submittedAt: assignmentSubmissions.submittedAt,
        releasedAt: assignmentSubmissions.releasedAt,
        marks: assignmentSubmissions.marks,
        isLate: assignmentSubmissions.isLate,
        maxMarks: assignments.maxMarks,
        passMarkPercent: assignments.passMarkPercent,
        title: assignments.title,
        courseTitle: courses.title,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
      .innerJoin(courses, eq(courses.id, assignments.courseId))
      .where(and(eq(assignmentSubmissions.userId, userId), inArray(assignmentSubmissions.status, ["submitted", "graded"])))
      .orderBy(desc(assignmentSubmissions.submittedAt))
      .limit(200),
  ]);
  return {
    // Marks are withheld here, on the server, until they have been released.
    attempts: attempts.map((a) => {
      const released = a.status === "graded" && a.releasedAt !== null;
      return {
        ...a,
        released,
        score: released ? a.score : null,
        percent: released ? a.percent : null,
        passed: released ? a.passed : null,
      };
    }),
    submissions: submissions.map((s) => {
      const released = s.status === "graded" && s.releasedAt !== null;
      return { ...s, released, marks: released ? s.marks : null };
    }),
  };
}

export async function myBookmarksAndNotes(userId: string) {
  const [marks, notes] = await Promise.all([
    db
      .select({
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        createdAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .innerJoin(lessons, eq(lessons.id, bookmarks.lessonId))
      .innerJoin(courses, eq(courses.id, lessons.courseId))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt)),
    db
      .select({
        lessonId: lessons.id,
        lessonTitle: lessons.title,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        content: lessonNotes.content,
        updatedAt: lessonNotes.updatedAt,
      })
      .from(lessonNotes)
      .innerJoin(lessons, eq(lessons.id, lessonNotes.lessonId))
      .innerJoin(courses, eq(courses.id, lessons.courseId))
      .where(eq(lessonNotes.userId, userId))
      .orderBy(desc(lessonNotes.updatedAt)),
  ]);
  return { bookmarks: marks, notes };
}

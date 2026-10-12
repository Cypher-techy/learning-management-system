import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../db";
import { assertCan, type Actor } from "../permissions";
import { assertCanManageCourse, managedCourseIds } from "../services/courses";

const {
  courses,
  categories,
  users,
  enrollments,
  lessons,
  modules,
  assessments,
  assessmentAttempts,
  assignments,
  assignmentSubmissions,
  announcements,
  liveSessions,
} = schema;

const activeEnrollments = sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.courseId} = ${courses.id} and ${enrollments.status} in ('active','completed'))`;
const completedEnrollments = sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.courseId} = ${courses.id} and ${enrollments.status} = 'completed')`;
const publishedLessonCount = sql<number>`(select count(*)::int from ${lessons} join ${modules} on ${modules.id} = ${lessons.moduleId} where ${lessons.courseId} = ${courses.id} and ${lessons.isPublished} and ${modules.isPublished})`;

export async function listManagedCourses(actor: Actor, mineOnly = false) {
  assertCan(actor, "course.create");
  const managed = mineOnly
    ? (await db.select({ id: schema.courseInstructors.courseId }).from(schema.courseInstructors).where(eq(schema.courseInstructors.userId, actor.id))).map((r) => r.id)
    : await managedCourseIds(actor);
  if (managed !== "all" && managed.length === 0) return [];
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      status: courses.status,
      priceCents: courses.priceCents,
      currency: courses.currency,
      updatedAt: courses.updatedAt,
      reviewNote: courses.reviewNote,
      categoryName: categories.name,
      enrolled: activeEnrollments,
      completed: completedEnrollments,
      lessons: publishedLessonCount,
    })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(managed === "all" ? undefined : inArray(courses.id, managed))
    .orderBy(desc(courses.updatedAt))
    .limit(500);
}

export type PendingItem = {
  kind: "attempt" | "submission";
  id: string;
  title: string;
  courseTitle: string;
  learnerName: string;
  submittedAt: Date | null;
  href: string;
};

/** Work waiting for a human mark in the actor's own courses. */
export async function pendingGrading(actor: Actor, limit = 100): Promise<PendingItem[]> {
  assertCan(actor, "grading.manage");
  // Instructors grade the courses they teach; this list is never platform-wide for them.
  const mine = db
    .select({ id: schema.courseInstructors.courseId })
    .from(schema.courseInstructors)
    .where(eq(schema.courseInstructors.userId, actor.id));
  const [attempts, submissions] = await Promise.all([
    db
      .select({
        id: assessmentAttempts.id,
        title: assessments.title,
        courseTitle: courses.title,
        learnerName: users.name,
        submittedAt: assessmentAttempts.submittedAt,
      })
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .innerJoin(courses, eq(courses.id, assessments.courseId))
      .innerJoin(users, eq(users.id, assessmentAttempts.userId))
      .where(and(eq(assessmentAttempts.status, "submitted"), inArray(assessments.courseId, mine)))
      .orderBy(asc(assessmentAttempts.submittedAt))
      .limit(limit),
    db
      .select({
        id: assignmentSubmissions.id,
        title: assignments.title,
        courseTitle: courses.title,
        learnerName: users.name,
        submittedAt: assignmentSubmissions.submittedAt,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
      .innerJoin(courses, eq(courses.id, assignments.courseId))
      .innerJoin(users, eq(users.id, assignmentSubmissions.userId))
      .where(and(eq(assignmentSubmissions.status, "submitted"), inArray(assignments.courseId, mine)))
      .orderBy(asc(assignmentSubmissions.submittedAt))
      .limit(limit),
  ]);
  return [
    ...attempts.map((a) => ({ kind: "attempt" as const, ...a, href: `/instructor/attempts/${a.id}` })),
    ...submissions.map((s) => ({ kind: "submission" as const, ...s, href: `/instructor/submissions/${s.id}` })),
  ].sort((a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0));
}

export async function instructorOverview(actor: Actor) {
  const [courseRows, pending] = await Promise.all([listManagedCourses(actor, true), pendingGrading(actor, 50)]);
  const ids = courseRows.map((c) => c.id);
  const [upcoming, recent] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              id: assessments.id,
              title: assessments.title,
              kind: assessments.kind,
              startsAt: assessments.startsAt,
              endsAt: assessments.endsAt,
              courseTitle: courses.title,
            })
            .from(assessments)
            .innerJoin(courses, eq(courses.id, assessments.courseId))
            .where(
              and(
                inArray(assessments.courseId, ids),
                eq(assessments.isPublished, true),
                or(gte(assessments.endsAt, new Date()), gte(assessments.startsAt, new Date())),
              ),
            )
            .orderBy(asc(sql`coalesce(${assessments.startsAt}, ${assessments.endsAt})`))
            .limit(6),
          db
            .select({
              id: assignmentSubmissions.id,
              title: assignments.title,
              learnerName: users.name,
              status: assignmentSubmissions.status,
              submittedAt: assignmentSubmissions.submittedAt,
            })
            .from(assignmentSubmissions)
            .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
            .innerJoin(users, eq(users.id, assignmentSubmissions.userId))
            .where(and(inArray(assignments.courseId, ids), inArray(assignmentSubmissions.status, ["submitted", "graded"])))
            .orderBy(desc(assignmentSubmissions.submittedAt))
            .limit(6),
        ]);
  const enrolled = courseRows.reduce((sum, c) => sum + c.enrolled, 0);
  const completed = courseRows.reduce((sum, c) => sum + c.completed, 0);
  return {
    courses: courseRows,
    pending,
    upcoming,
    recent,
    totals: {
      courses: courseRows.length,
      published: courseRows.filter((c) => c.status === "published").length,
      enrolled,
      completionRate: enrolled === 0 ? 0 : Math.round((completed / enrolled) * 100),
    },
  };
}

/** Enrollment list for one course. Email addresses are visible to its teaching team only. */
export async function courseLearners(actor: Actor, courseId: string, options: { q?: string; page: number; pageSize: number }) {
  await assertCanManageCourse(actor, courseId);
  const where: SQL[] = [eq(enrollments.courseId, courseId)];
  const q = options.q?.trim().slice(0, 100);
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }
  const [rows, [total]] = await Promise.all([
    db
      .select({
        enrollmentId: enrollments.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        status: enrollments.status,
        source: enrollments.source,
        progressPercent: enrollments.progressPercent,
        enrolledAt: enrollments.enrolledAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        completedAt: enrollments.completedAt,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .where(and(...where))
      .orderBy(desc(enrollments.enrolledAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
    db.select({ n: count() }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).where(and(...where)),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function courseAnalytics(actor: Actor, courseId: string) {
  await assertCanManageCourse(actor, courseId);
  const since = new Date(Date.now() - 12 * 7 * 24 * 3600_000);
  const [[summary], weekly, distribution, assessmentStats, assignmentStats] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${enrollments.status} = 'active')::int`,
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')::int`,
        averageProgress: sql<number>`coalesce(round(avg(${enrollments.progressPercent}) filter (where ${enrollments.status} in ('active','completed'))), 0)::int`,
      })
      .from(enrollments)
      .where(eq(enrollments.courseId, courseId)),
    db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${enrollments.enrolledAt}), 'YYYY-MM-DD')`,
        n: count(),
      })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), gte(enrollments.enrolledAt, since)))
      .groupBy(sql`date_trunc('week', ${enrollments.enrolledAt})`)
      .orderBy(sql`date_trunc('week', ${enrollments.enrolledAt})`),
    db
      .select({
        bucket: sql<string>`case when ${enrollments.progressPercent} >= 100 then '100%' when ${enrollments.progressPercent} >= 75 then '75-99%' when ${enrollments.progressPercent} >= 50 then '50-74%' when ${enrollments.progressPercent} >= 25 then '25-49%' when ${enrollments.progressPercent} > 0 then '1-24%' else 'Not started' end`,
        n: count(),
      })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), inArray(enrollments.status, ["active", "completed"])))
      .groupBy(sql`1`),
    db
      .select({
        id: assessments.id,
        title: assessments.title,
        attempts: sql<number>`count(${assessmentAttempts.id}) filter (where ${assessmentAttempts.status} = 'graded')::int`,
        average: sql<number | null>`round(avg(${assessmentAttempts.percent}) filter (where ${assessmentAttempts.status} = 'graded'))::int`,
        passRate: sql<number | null>`round(100.0 * count(*) filter (where ${assessmentAttempts.passed}) / nullif(count(*) filter (where ${assessmentAttempts.status} = 'graded'), 0))::int`,
      })
      .from(assessments)
      .leftJoin(assessmentAttempts, eq(assessmentAttempts.assessmentId, assessments.id))
      .where(eq(assessments.courseId, courseId))
      .groupBy(assessments.id, assessments.title, assessments.createdAt)
      .orderBy(asc(assessments.createdAt)),
    db
      .select({
        id: assignments.id,
        title: assignments.title,
        maxMarks: assignments.maxMarks,
        submitted: sql<number>`count(${assignmentSubmissions.id}) filter (where ${assignmentSubmissions.status} <> 'draft')::int`,
        graded: sql<number>`count(${assignmentSubmissions.id}) filter (where ${assignmentSubmissions.status} = 'graded')::int`,
        average: sql<number | null>`round(avg(${assignmentSubmissions.marks}) filter (where ${assignmentSubmissions.status} = 'graded'))::int`,
      })
      .from(assignments)
      .leftJoin(assignmentSubmissions, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(eq(assignments.courseId, courseId))
      .groupBy(assignments.id, assignments.title, assignments.maxMarks, assignments.createdAt)
      .orderBy(asc(assignments.createdAt)),
  ]);
  const order = ["Not started", "1-24%", "25-49%", "50-74%", "75-99%", "100%"];
  return {
    summary: summary ?? { total: 0, active: 0, completed: 0, averageProgress: 0 },
    weekly,
    distribution: order.map((bucket) => ({ bucket, learners: distribution.find((d) => d.bucket === bucket)?.n ?? 0 })),
    assessments: assessmentStats,
    assignments: assignmentStats,
  };
}

export async function courseAssessmentsList(actor: Actor, courseId: string) {
  await assertCanManageCourse(actor, courseId);
  return db
    .select({
      id: assessments.id,
      kind: assessments.kind,
      title: assessments.title,
      isPublished: assessments.isPublished,
      startsAt: assessments.startsAt,
      endsAt: assessments.endsAt,
      questions: sql<number>`(select count(*)::int from ${schema.assessmentQuestions} where ${schema.assessmentQuestions.assessmentId} = ${assessments.id})`,
      attempts: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id})`,
      toGrade: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.status} = 'submitted')`,
      held: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.status} = 'graded' and ${assessmentAttempts.releasedAt} is null)`,
    })
    .from(assessments)
    .where(eq(assessments.courseId, courseId))
    .orderBy(asc(assessments.createdAt));
}

export async function courseAssignmentsList(actor: Actor, courseId: string) {
  await assertCanManageCourse(actor, courseId);
  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      isPublished: assignments.isPublished,
      dueAt: assignments.dueAt,
      submitted: sql<number>`(select count(*)::int from ${assignmentSubmissions} where ${assignmentSubmissions.assignmentId} = ${assignments.id} and ${assignmentSubmissions.status} <> 'draft')`,
      toGrade: sql<number>`(select count(*)::int from ${assignmentSubmissions} where ${assignmentSubmissions.assignmentId} = ${assignments.id} and ${assignmentSubmissions.status} = 'submitted')`,
    })
    .from(assignments)
    .where(eq(assignments.courseId, courseId))
    .orderBy(asc(assignments.createdAt));
}

export async function courseCommunication(actor: Actor, courseId: string) {
  await assertCanManageCourse(actor, courseId);
  const [news, sessions] = await Promise.all([
    db
      .select({ id: announcements.id, title: announcements.title, body: announcements.body, createdAt: announcements.createdAt, authorName: users.name })
      .from(announcements)
      .leftJoin(users, eq(users.id, announcements.authorId))
      .where(eq(announcements.courseId, courseId))
      .orderBy(desc(announcements.createdAt))
      .limit(50),
    db.select().from(liveSessions).where(eq(liveSessions.courseId, courseId)).orderBy(desc(liveSessions.startsAt)).limit(50),
  ]);
  return { announcements: news, sessions };
}

export async function courseLessonOptions(courseId: string) {
  return db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(eq(lessons.courseId, courseId))
    .orderBy(asc(modules.position), asc(lessons.position));
}

import "server-only";
import { and, asc, count, desc, eq, gte, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../db";
import { notFound } from "../errors";
import { assertCan, type Actor } from "../permissions";

const {
  users,
  profiles,
  sessions,
  courses,
  categories,
  enrollments,
  assessments,
  assessmentAttempts,
  certificates,
  certificateTemplates,
  paymentTransactions,
  refunds,
  instructorApplications,
  supportRequests,
  contentReports,
  discussions,
  discussionReplies,
  auditLogs,
  announcements,
} = schema;

const like = (q: string) => `%${q.trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const weeksAgo = (n: number) => new Date(Date.now() - n * 7 * 24 * 3600_000);

export async function adminOverview(actor: Actor) {
  assertCan(actor, "user.manage");
  const since = weeksAgo(12);
  const [
    roleRows,
    courseRows,
    [enrollmentStats],
    [attemptStats],
    [certificateStats],
    revenue,
    [pendingCourses],
    [pendingApplications],
    [openSupport],
    [openReports],
    [openRefunds],
    [suspended],
    signups,
    enrollmentTrend,
    recentAudit,
  ] = await Promise.all([
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
    db.select({ status: courses.status, n: count() }).from(courses).groupBy(courses.status),
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${enrollments.status} = 'active')::int`,
        completed: sql<number>`count(*) filter (where ${enrollments.status} = 'completed')::int`,
      })
      .from(enrollments),
    db
      .select({
        graded: sql<number>`count(*) filter (where ${assessmentAttempts.status} = 'graded')::int`,
        awaiting: sql<number>`count(*) filter (where ${assessmentAttempts.status} = 'submitted')::int`,
        average: sql<number | null>`round(avg(${assessmentAttempts.percent}) filter (where ${assessmentAttempts.status} = 'graded'))::int`,
        passRate: sql<number | null>`round(100.0 * count(*) filter (where ${assessmentAttempts.passed}) / nullif(count(*) filter (where ${assessmentAttempts.status} = 'graded'), 0))::int`,
      })
      .from(assessmentAttempts),
    db
      .select({
        valid: sql<number>`count(*) filter (where ${certificates.status} = 'valid')::int`,
        revoked: sql<number>`count(*) filter (where ${certificates.status} = 'revoked')::int`,
      })
      .from(certificates),
    db
      .select({
        currency: paymentTransactions.currency,
        total: sql<number>`coalesce(sum(${paymentTransactions.amountCents}), 0)::bigint`,
        n: count(),
      })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.status, "succeeded"))
      .groupBy(paymentTransactions.currency),
    db.select({ n: count() }).from(courses).where(eq(courses.status, "pending_review")),
    db.select({ n: count() }).from(instructorApplications).where(eq(instructorApplications.status, "pending")),
    db.select({ n: count() }).from(supportRequests).where(eq(supportRequests.status, "open")),
    db.select({ n: count() }).from(contentReports).where(eq(contentReports.status, "open")),
    db.select({ n: count() }).from(refunds).where(eq(refunds.status, "requested")),
    db.select({ n: count() }).from(users).where(eq(users.banned, true)),
    db
      .select({ week: sql<string>`to_char(date_trunc('week', ${users.createdAt}), 'MM-DD')`, n: count() })
      .from(users)
      .where(gte(users.createdAt, since))
      .groupBy(sql`date_trunc('week', ${users.createdAt})`)
      .orderBy(sql`date_trunc('week', ${users.createdAt})`),
    db
      .select({ week: sql<string>`to_char(date_trunc('week', ${enrollments.enrolledAt}), 'MM-DD')`, n: count() })
      .from(enrollments)
      .where(gte(enrollments.enrolledAt, since))
      .groupBy(sql`date_trunc('week', ${enrollments.enrolledAt})`)
      .orderBy(sql`date_trunc('week', ${enrollments.enrolledAt})`),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);
  const byRole = (role: string) => roleRows.find((r) => r.role === role)?.n ?? 0;
  const byStatus = (status: string) => courseRows.find((r) => r.status === status)?.n ?? 0;
  return {
    users: {
      total: roleRows.reduce((sum, r) => sum + r.n, 0),
      students: byRole("student"),
      instructors: byRole("instructor"),
      admins: byRole("admin"),
      suspended: suspended?.n ?? 0,
    },
    courses: { published: byStatus("published"), draft: byStatus("draft"), total: courseRows.reduce((sum, r) => sum + r.n, 0) },
    enrollments: enrollmentStats ?? { total: 0, active: 0, completed: 0 },
    attempts: attemptStats ?? { graded: 0, awaiting: 0, average: null, passRate: null },
    certificates: certificateStats ?? { valid: 0, revoked: 0 },
    revenue: revenue.map((r) => ({ currency: r.currency, totalCents: Number(r.total), payments: r.n })),
    alerts: {
      pendingCourses: pendingCourses?.n ?? 0,
      pendingApplications: pendingApplications?.n ?? 0,
      openSupport: openSupport?.n ?? 0,
      openReports: openReports?.n ?? 0,
      openRefunds: openRefunds?.n ?? 0,
    },
    signups: signups.map((s) => ({ week: s.week, users: s.n })),
    enrollmentTrend: enrollmentTrend.map((s) => ({ week: s.week, enrollments: s.n })),
    recentAudit,
  };
}

type Paging = { page: number; pageSize: number };

export async function listUsers(actor: Actor, f: { q?: string; role?: string; status?: string } & Paging) {
  assertCan(actor, "user.manage");
  const where: SQL[] = [];
  if (f.q?.trim()) where.push(or(ilike(users.name, like(f.q)), ilike(users.email, like(f.q)))!);
  if (f.role === "student" || f.role === "instructor" || f.role === "admin") where.push(eq(users.role, f.role));
  if (f.status === "suspended") where.push(eq(users.banned, true));
  if (f.status === "active") where.push(eq(users.banned, false));
  const cond = where.length ? and(...where) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, banned: users.banned, createdAt: users.createdAt })
      .from(users)
      .where(cond)
      .orderBy(desc(users.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(users).where(cond),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function userDetail(actor: Actor, userId: string) {
  assertCan(actor, "user.manage");
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound("The user");
  const [[profile], [sessionCount], enrolled, certs, activity] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, userId)),
    db.select({ n: count() }).from(sessions).where(and(eq(sessions.userId, userId), gte(sessions.expiresAt, new Date()))),
    db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        source: enrollments.source,
        progressPercent: enrollments.progressPercent,
        enrolledAt: enrollments.enrolledAt,
        courseTitle: courses.title,
      })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(eq(enrollments.userId, userId))
      .orderBy(desc(enrollments.enrolledAt)),
    db.select({ n: count() }).from(certificates).where(eq(certificates.userId, userId)),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(and(eq(auditLogs.entityType, "user"), eq(auditLogs.entityId, userId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);
  return { user, profile: profile ?? null, activeSessions: sessionCount?.n ?? 0, enrollments: enrolled, certificates: certs[0]?.n ?? 0, activity };
}

export async function listApplications(actor: Actor) {
  assertCan(actor, "instructor.approve");
  return db
    .select({ application: instructorApplications, name: users.name, email: users.email })
    .from(instructorApplications)
    .innerJoin(users, eq(users.id, instructorApplications.userId))
    .orderBy(sql`case when ${instructorApplications.status} = 'pending' then 0 else 1 end`, desc(instructorApplications.createdAt))
    .limit(200);
}

export async function listEnrollments(actor: Actor, f: { q?: string; status?: string } & Paging) {
  assertCan(actor, "enrollment.manage");
  const where: SQL[] = [];
  if (f.q?.trim()) where.push(or(ilike(users.name, like(f.q)), ilike(users.email, like(f.q)), ilike(courses.title, like(f.q)))!);
  if ((schema.enrollmentStatus.enumValues as string[]).includes(f.status ?? "")) {
    where.push(eq(enrollments.status, f.status as (typeof schema.enrollmentStatus.enumValues)[number]));
  }
  const cond = where.length ? and(...where) : undefined;
  const base = () => db.select({ n: count() }).from(enrollments).innerJoin(users, eq(users.id, enrollments.userId)).innerJoin(courses, eq(courses.id, enrollments.courseId));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        source: enrollments.source,
        progressPercent: enrollments.progressPercent,
        enrolledAt: enrollments.enrolledAt,
        learnerName: users.name,
        learnerEmail: users.email,
        courseTitle: courses.title,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.userId))
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(cond)
      .orderBy(desc(enrollments.enrolledAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    base().where(cond),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function listAllCourses(actor: Actor, f: { q?: string; status?: string } & Paging) {
  assertCan(actor, "course.manage_any");
  const where: SQL[] = [];
  if (f.q?.trim()) where.push(or(ilike(courses.title, like(f.q)), ilike(users.name, like(f.q)))!);
  if ((schema.courseStatus.enumValues as string[]).includes(f.status ?? "")) {
    where.push(eq(courses.status, f.status as (typeof schema.courseStatus.enumValues)[number]));
  }
  const cond = where.length ? and(...where) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: courses.id,
        slug: courses.slug,
        title: courses.title,
        status: courses.status,
        priceCents: courses.priceCents,
        currency: courses.currency,
        updatedAt: courses.updatedAt,
        ownerName: users.name,
        categoryName: categories.name,
        enrolled: sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.courseId} = ${courses.id} and ${enrollments.status} in ('active','completed'))`,
      })
      .from(courses)
      .innerJoin(users, eq(users.id, courses.ownerId))
      .leftJoin(categories, eq(categories.id, courses.categoryId))
      .where(cond)
      .orderBy(sql`case when ${courses.status} = 'pending_review' then 0 else 1 end`, desc(courses.updatedAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(courses).innerJoin(users, eq(users.id, courses.ownerId)).where(cond),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function assessmentsOversight(actor: Actor, f: Paging) {
  assertCan(actor, "assessment.oversee");
  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: assessments.id,
        title: assessments.title,
        kind: assessments.kind,
        isPublished: assessments.isPublished,
        endsAt: assessments.endsAt,
        courseTitle: courses.title,
        attempts: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id})`,
        awaiting: sql<number>`(select count(*)::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.status} = 'submitted')`,
        average: sql<number | null>`(select round(avg(${assessmentAttempts.percent}))::int from ${assessmentAttempts} where ${assessmentAttempts.assessmentId} = ${assessments.id} and ${assessmentAttempts.status} = 'graded')`,
      })
      .from(assessments)
      .innerJoin(courses, eq(courses.id, assessments.courseId))
      .orderBy(desc(assessments.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(assessments),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function listCertificates(actor: Actor, f: { q?: string } & Paging) {
  assertCan(actor, "certificate.manage");
  const cond = f.q?.trim()
    ? or(ilike(certificates.number, like(f.q)), ilike(certificates.learnerName, like(f.q)), ilike(certificates.courseTitle, like(f.q)))
    : undefined;
  const [rows, [total], templates] = await Promise.all([
    db.select().from(certificates).where(cond).orderBy(desc(certificates.issuedAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(certificates).where(cond),
    db.select().from(certificateTemplates).orderBy(desc(certificateTemplates.isDefault), asc(certificateTemplates.createdAt)),
  ]);
  return { rows, total: total?.n ?? 0, templates };
}

export async function listPlatformAnnouncements(actor: Actor) {
  assertCan(actor, "announcement.platform");
  return db
    .select({ id: announcements.id, title: announcements.title, body: announcements.body, createdAt: announcements.createdAt, authorName: users.name })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .where(isNull(announcements.courseId))
    .orderBy(desc(announcements.createdAt))
    .limit(100);
}

export async function supportInbox(actor: Actor, status?: string) {
  assertCan(actor, "support.manage");
  const valid = status === "open" || status === "in_progress" || status === "closed" ? status : undefined;
  const [requests, reports] = await Promise.all([
    db
      .select()
      .from(supportRequests)
      .where(valid ? eq(supportRequests.status, valid) : undefined)
      .orderBy(sql`case ${supportRequests.status} when 'open' then 0 when 'in_progress' then 1 else 2 end`, desc(supportRequests.createdAt))
      .limit(100),
    db
      .select({
        report: contentReports,
        reporterName: users.name,
        discussionTitle: discussions.title,
        discussionBody: discussions.body,
        replyBody: discussionReplies.body,
        replyDiscussionId: discussionReplies.discussionId,
      })
      .from(contentReports)
      .innerJoin(users, eq(users.id, contentReports.reporterId))
      .leftJoin(discussions, eq(discussions.id, contentReports.discussionId))
      .leftJoin(discussionReplies, eq(discussionReplies.id, contentReports.replyId))
      .where(eq(contentReports.status, "open"))
      .orderBy(desc(contentReports.createdAt))
      .limit(100),
  ]);
  return { requests, reports };
}

export async function listPayments(actor: Actor, f: { status?: string } & Paging) {
  assertCan(actor, "payment.manage");
  const cond = (schema.paymentStatus.enumValues as string[]).includes(f.status ?? "")
    ? eq(paymentTransactions.status, f.status as (typeof schema.paymentStatus.enumValues)[number])
    : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({ transaction: paymentTransactions, learnerName: users.name, learnerEmail: users.email, courseTitle: courses.title })
      .from(paymentTransactions)
      .innerJoin(users, eq(users.id, paymentTransactions.userId))
      .innerJoin(courses, eq(courses.id, paymentTransactions.courseId))
      .where(cond)
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(paymentTransactions).where(cond),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function listAudit(actor: Actor, f: { q?: string } & Paging) {
  assertCan(actor, "audit.view");
  const cond = f.q?.trim() ? or(ilike(auditLogs.action, like(f.q)), ilike(users.name, like(f.q)), ilike(auditLogs.entityType, like(f.q))) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({ log: auditLogs, actorName: users.name, actorEmail: users.email })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(cond)
      .orderBy(desc(auditLogs.createdAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(cond),
  ]);
  return { rows, total: total?.n ?? 0 };
}

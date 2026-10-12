import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { AppError, invalid } from "../errors";
import { assertCan, type Actor } from "../permissions";
import { logAudit } from "../services/audit";
import { assertCanManageCourse } from "../services/courses";

const { users, courses, enrollments, assessments, assessmentAttempts, assignments, assignmentSubmissions, paymentTransactions, certificates } = schema;

type Rows = Array<Record<string, unknown>>;
const LIMIT = 20_000;

const uuid = (value: string | null, name: string) => {
  if (!value || !/^[0-9a-f-]{36}$/i.test(value)) throw invalid(`A valid ${name} is required.`);
  return value;
};

/**
 * Builds the rows for a CSV report. Every report checks the caller's
 * permission and, for course reports, that the course is one they manage.
 */
export async function buildExport(actor: Actor, report: string, params: URLSearchParams): Promise<{ filename: string; rows: Rows }> {
  assertCan(actor, "report.export");
  let result: { filename: string; rows: Rows };

  switch (report) {
    case "course-learners": {
      const courseId = uuid(params.get("courseId"), "course");
      const course = await assertCanManageCourse(actor, courseId);
      const rows = await db
        .select({
          name: users.name,
          email: users.email,
          status: enrollments.status,
          source: enrollments.source,
          progress_percent: enrollments.progressPercent,
          enrolled_at: enrollments.enrolledAt,
          last_active_at: enrollments.lastAccessedAt,
          completed_at: enrollments.completedAt,
        })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.userId))
        .where(eq(enrollments.courseId, courseId))
        .orderBy(asc(users.name))
        .limit(LIMIT);
      result = { filename: `learners-${course.slug}`, rows };
      break;
    }
    case "assessment-results": {
      assertCan(actor, "grading.manage");
      const assessmentId = uuid(params.get("assessmentId"), "assessment");
      const [assessment] = await db.select().from(assessments).where(eq(assessments.id, assessmentId));
      if (!assessment) throw new AppError("NOT_FOUND", "The assessment could not be found.");
      await assertCanManageCourse(actor, assessment.courseId);
      const rows = await db
        .select({
          name: users.name,
          email: users.email,
          attempt: assessmentAttempts.attemptNumber,
          status: assessmentAttempts.status,
          score: assessmentAttempts.score,
          max_score: assessmentAttempts.maxScore,
          percent: assessmentAttempts.percent,
          passed: assessmentAttempts.passed,
          started_at: assessmentAttempts.startedAt,
          submitted_at: assessmentAttempts.submittedAt,
          auto_submitted: assessmentAttempts.autoSubmitted,
          released_at: assessmentAttempts.releasedAt,
        })
        .from(assessmentAttempts)
        .innerJoin(users, eq(users.id, assessmentAttempts.userId))
        .where(eq(assessmentAttempts.assessmentId, assessmentId))
        .orderBy(asc(users.name), asc(assessmentAttempts.attemptNumber))
        .limit(LIMIT);
      result = { filename: "assessment-results", rows };
      break;
    }
    case "assignment-results": {
      assertCan(actor, "grading.manage");
      const assignmentId = uuid(params.get("assignmentId"), "assignment");
      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) throw new AppError("NOT_FOUND", "The assignment could not be found.");
      await assertCanManageCourse(actor, assignment.courseId);
      result = { filename: "assignment-results", rows: await assignmentRows(assignmentId) };
      break;
    }
    case "users": {
      assertCan(actor, "user.manage");
      const rows = await db
        .select({ name: users.name, email: users.email, role: users.role, suspended: users.banned, email_verified: users.emailVerified, created_at: users.createdAt })
        .from(users)
        .orderBy(asc(users.createdAt))
        .limit(LIMIT);
      result = { filename: "users", rows };
      break;
    }
    case "enrollments": {
      assertCan(actor, "enrollment.manage");
      const rows = await db
        .select({
          learner: users.name,
          email: users.email,
          course: courses.title,
          status: enrollments.status,
          source: enrollments.source,
          progress_percent: enrollments.progressPercent,
          enrolled_at: enrollments.enrolledAt,
          completed_at: enrollments.completedAt,
        })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.userId))
        .innerJoin(courses, eq(courses.id, enrollments.courseId))
        .orderBy(desc(enrollments.enrolledAt))
        .limit(LIMIT);
      result = { filename: "enrollments", rows };
      break;
    }
    case "payments": {
      assertCan(actor, "payment.manage");
      const rows = await db
        .select({
          learner: users.name,
          email: users.email,
          course: courses.title,
          provider: paymentTransactions.provider,
          amount: paymentTransactions.amountCents,
          currency: paymentTransactions.currency,
          status: paymentTransactions.status,
          receipt: paymentTransactions.receiptNumber,
          created_at: paymentTransactions.createdAt,
          completed_at: paymentTransactions.completedAt,
        })
        .from(paymentTransactions)
        .innerJoin(users, eq(users.id, paymentTransactions.userId))
        .innerJoin(courses, eq(courses.id, paymentTransactions.courseId))
        .orderBy(desc(paymentTransactions.createdAt))
        .limit(LIMIT);
      result = { filename: "payments", rows: rows.map((r) => ({ ...r, amount: (r.amount / 100).toFixed(2) })) };
      break;
    }
    case "certificates": {
      assertCan(actor, "certificate.manage");
      const rows = await db
        .select({
          number: certificates.number,
          learner: certificates.learnerName,
          course: certificates.courseTitle,
          status: certificates.status,
          score: certificates.score,
          issued_at: certificates.issuedAt,
          revoked_at: certificates.revokedAt,
        })
        .from(certificates)
        .orderBy(desc(certificates.issuedAt))
        .limit(LIMIT);
      result = { filename: "certificates", rows };
      break;
    }
    default:
      throw new AppError("NOT_FOUND", "Unknown report.");
  }

  await logAudit(db, {
    actorId: actor.id,
    action: "report.export",
    entityType: "report",
    entityId: report,
    metadata: { rows: result.rows.length, params: Object.fromEntries(params) },
  });
  return result;
}

async function assignmentRows(assignmentId: string): Promise<Rows> {
  return db
    .select({
      name: users.name,
      email: users.email,
      status: assignmentSubmissions.status,
      marks: assignmentSubmissions.marks,
      late: assignmentSubmissions.isLate,
      submitted_at: assignmentSubmissions.submittedAt,
      graded_at: assignmentSubmissions.gradedAt,
      released_at: assignmentSubmissions.releasedAt,
    })
    .from(assignmentSubmissions)
    .innerJoin(users, eq(users.id, assignmentSubmissions.userId))
    // Drafts are private to the learner and are never exported.
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), inArray(assignmentSubmissions.status, ["submitted", "graded"])))
    .orderBy(asc(users.name))
    .limit(LIMIT);
}

import { randomInt } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { roundMarks } from "@/lib/format";
import { db, schema, type DbOrTx, type Tx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, can, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { assertCanManageCourse, managedCourseIds } from "./courses";
import { withNotifications, type Notify } from "./notifications";
import { awardBadge, evaluateCompletion, LEARNER_VISIBLE_COURSE_STATUSES, recordActivity } from "./progress";

const {
  assessments,
  assessmentQuestions,
  assessmentAttempts,
  attemptAnswers,
  questions,
  questionOptions,
  questionBanks,
  courses,
  enrollments,
  users,
} = schema;

export type Assessment = typeof assessments.$inferSelect;
export type Attempt = typeof assessmentAttempts.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type QuestionType = Question["type"];

/** Network allowance when comparing a save or submit against the deadline. */
export const DEADLINE_GRACE_MS = 15_000;

export const MANUAL_TYPES: QuestionType[] = ["essay", "file_upload"];
export const OPTION_TYPES: QuestionType[] = ["multiple_choice", "multiple_select", "true_false"];

// ===========================================================================
// Question banks and questions (instructor)
// ===========================================================================

async function assertBankAccess(actor: Actor, bankId: string, conn: DbOrTx = db) {
  assertCan(actor, "question_bank.manage");
  const [bank] = await conn.select().from(questionBanks).where(eq(questionBanks.id, bankId));
  if (!bank) throw notFound("The question bank");
  if (bank.ownerId === actor.id || can(actor, "course.manage_any")) return bank;
  if (bank.courseId) {
    await assertCanManageCourse(actor, bank.courseId, conn);
    return bank;
  }
  throw forbidden("You do not have access to this question bank.");
}

export async function listAccessibleBanks(actor: Actor) {
  assertCan(actor, "question_bank.manage");
  const managed = await managedCourseIds(actor);
  const where =
    managed === "all"
      ? undefined
      : managed.length > 0
        ? or(eq(questionBanks.ownerId, actor.id), inArray(questionBanks.courseId, managed))
        : eq(questionBanks.ownerId, actor.id);
  return db
    .select({
      id: questionBanks.id,
      title: questionBanks.title,
      description: questionBanks.description,
      courseId: questionBanks.courseId,
      courseTitle: courses.title,
      questionCount: sql<number>`(select count(*)::int from ${questions} where ${questions.bankId} = ${questionBanks.id})`,
    })
    .from(questionBanks)
    .leftJoin(courses, eq(courses.id, questionBanks.courseId))
    .where(where)
    .orderBy(desc(questionBanks.createdAt));
}

export const bankSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default(""),
  courseId: z.string().uuid().nullable().default(null),
});

export async function createBank(actor: Actor, input: z.infer<typeof bankSchema>) {
  assertCan(actor, "question_bank.manage");
  const data = bankSchema.parse(input);
  if (data.courseId) await assertCanManageCourse(actor, data.courseId);
  const [bank] = await db.insert(questionBanks).values({ ...data, ownerId: actor.id }).returning();
  return bank!;
}

export async function deleteBank(actor: Actor, bankId: string) {
  await assertBankAccess(actor, bankId);
  const [used] = await db
    .select({ n: count() })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
    .where(eq(questions.bankId, bankId));
  if ((used?.n ?? 0) > 0) {
    throw conflict("Questions from this bank are used in assessments. Remove them there first.");
  }
  await db.delete(questionBanks).where(eq(questionBanks.id, bankId));
}

/** Every course has a default bank that receives questions written in the assessment editor. */
async function courseBank(conn: DbOrTx, actor: Actor, courseId: string) {
  const [existing] = await conn
    .select()
    .from(questionBanks)
    .where(eq(questionBanks.courseId, courseId))
    .orderBy(asc(questionBanks.createdAt))
    .limit(1);
  if (existing) return existing;
  const [course] = await conn.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId));
  const [created] = await conn
    .insert(questionBanks)
    .values({ ownerId: actor.id, courseId, title: `${course?.title ?? "Course"} questions` })
    .returning();
  return created!;
}

export const questionSchema = z
  .object({
    type: z.enum(schema.questionType.enumValues),
    text: z.string().trim().min(3, "Write the question.").max(5000),
    explanation: z.string().trim().max(5000).default(""),
    marks: z.number().min(0.25).max(1000),
    options: z
      .array(z.object({ text: z.string().trim().min(1).max(1000), isCorrect: z.boolean() }))
      .max(12)
      .default([]),
    acceptedAnswers: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.type === "multiple_choice") {
      if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options." });
      if (correct !== 1) ctx.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one option as correct." });
    }
    if (q.type === "multiple_select") {
      if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options." });
      if (correct < 1) ctx.addIssue({ code: "custom", path: ["options"], message: "Mark at least one option as correct." });
    }
    if (q.type === "true_false" && (q.options.length !== 2 || correct !== 1)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Choose whether the statement is true or false." });
    }
  });

export type QuestionInput = z.input<typeof questionSchema>;

async function writeQuestion(tx: DbOrTx, bankId: string, questionId: string | null, data: z.infer<typeof questionSchema>) {
  const usesOptions = OPTION_TYPES.includes(data.type);
  const fields = {
    type: data.type,
    text: data.text,
    explanation: data.explanation,
    marks: data.marks,
    acceptedAnswers: data.type === "short_answer" ? data.acceptedAnswers : [],
  };
  let id = questionId;
  if (id) {
    await tx.update(questions).set(fields).where(eq(questions.id, id));
    await tx.delete(questionOptions).where(eq(questionOptions.questionId, id));
  } else {
    const [row] = await tx.insert(questions).values({ ...fields, bankId }).returning({ id: questions.id });
    id = row!.id;
  }
  if (usesOptions && data.options.length > 0) {
    await tx.insert(questionOptions).values(
      data.options.map((o, position) => ({ questionId: id!, text: o.text, isCorrect: o.isCorrect, position })),
    );
  }
  return id;
}

export async function createQuestion(actor: Actor, bankId: string, input: QuestionInput) {
  const data = questionSchema.parse(input);
  await assertBankAccess(actor, bankId);
  return db.transaction((tx) => writeQuestion(tx, bankId, null, data));
}

export async function updateQuestion(actor: Actor, questionId: string, input: QuestionInput) {
  const data = questionSchema.parse(input);
  const [question] = await db.select().from(questions).where(eq(questions.id, questionId));
  if (!question) throw notFound("The question");
  await assertBankAccess(actor, question.bankId);
  // Options are rewritten, so answers already given could no longer be
  // graded against them. Refuse rather than silently corrupt results.
  const [answered] = await db
    .select({ n: count() })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.questionId, questionId));
  if ((answered?.n ?? 0) > 0) {
    throw conflict("Learners have already answered this question. Create a new question instead of editing it.");
  }
  await db.transaction((tx) => writeQuestion(tx, question.bankId, questionId, data));
}

export async function deleteQuestion(actor: Actor, questionId: string) {
  const [question] = await db.select().from(questions).where(eq(questions.id, questionId));
  if (!question) throw notFound("The question");
  await assertBankAccess(actor, question.bankId);
  const [used] = await db
    .select({ n: count() })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.questionId, questionId));
  if ((used?.n ?? 0) > 0) throw conflict("This question is used in an assessment. Remove it there first.");
  await db.delete(questions).where(eq(questions.id, questionId));
}

export async function getBankWithQuestions(actor: Actor, bankId: string) {
  const bank = await assertBankAccess(actor, bankId);
  const rows = await db.select().from(questions).where(eq(questions.bankId, bankId)).orderBy(asc(questions.createdAt));
  const options =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, rows.map((r) => r.id)))
          .orderBy(asc(questionOptions.position));
  return { bank, questions: rows.map((q) => ({ ...q, options: options.filter((o) => o.questionId === q.id) })) };
}

// ===========================================================================
// Assessments (instructor)
// ===========================================================================

export const assessmentSchema = z
  .object({
    kind: z.enum(schema.assessmentKind.enumValues),
    title: z.string().trim().min(3).max(160),
    instructions: z.string().trim().max(10000).default(""),
    lessonId: z.string().uuid().nullable().default(null),
    startsAt: z.date().nullable().default(null),
    endsAt: z.date().nullable().default(null),
    timeLimitMinutes: z.number().int().min(1).max(1440).nullable().default(null),
    passMarkPercent: z.number().int().min(0).max(100),
    maxAttempts: z.number().int().min(1).max(50),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    negativeMarkingPercent: z.number().int().min(0).max(100).default(0),
    resultRelease: z.enum(schema.resultRelease.enumValues),
    showCorrectAnswers: z.boolean().default(false),
    requiredForCompletion: z.boolean().default(true),
  })
  .refine((a) => !a.startsAt || !a.endsAt || a.endsAt > a.startsAt, {
    path: ["endsAt"],
    message: "The closing time must be after the opening time.",
  });

export type AssessmentInput = z.input<typeof assessmentSchema>;

async function loadAssessment(conn: DbOrTx, assessmentId: string) {
  const [row] = await conn.select().from(assessments).where(eq(assessments.id, assessmentId));
  if (!row) throw notFound("The assessment");
  return row;
}

async function assertLessonInCourse(conn: DbOrTx, lessonId: string | null, courseId: string) {
  if (!lessonId) return;
  const [lesson] = await conn
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.courseId, courseId)));
  if (!lesson) throw invalid("Choose a lesson from this course.");
}

export async function createAssessment(actor: Actor, courseId: string, input: AssessmentInput) {
  const data = assessmentSchema.parse(input);
  await assertCanManageCourse(actor, courseId);
  await assertLessonInCourse(db, data.lessonId, courseId);
  const [row] = await db.insert(assessments).values({ ...data, courseId, createdBy: actor.id }).returning();
  return row!;
}

export async function updateAssessment(actor: Actor, assessmentId: string, input: AssessmentInput) {
  const data = assessmentSchema.parse(input);
  const assessment = await loadAssessment(db, assessmentId);
  await assertCanManageCourse(actor, assessment.courseId);
  await assertLessonInCourse(db, data.lessonId, assessment.courseId);
  await db.update(assessments).set(data).where(eq(assessments.id, assessmentId));
  return assessment;
}

export async function deleteAssessment(actor: Actor, assessmentId: string) {
  const assessment = await loadAssessment(db, assessmentId);
  await assertCanManageCourse(actor, assessment.courseId);
  const [attempted] = await db
    .select({ n: count() })
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.assessmentId, assessmentId));
  if ((attempted?.n ?? 0) > 0) {
    throw conflict("Learners have attempted this assessment. Unpublish it instead of deleting it.");
  }
  await db.delete(assessments).where(eq(assessments.id, assessmentId));
  await logAudit(db, { actorId: actor.id, action: "assessment.delete", entityType: "assessment", entityId: assessmentId });
  return assessment;
}

export async function setAssessmentPublished(actor: Actor, assessmentId: string, published: boolean) {
  return withNotifications(async (tx, notify) => {
    const assessment = await loadAssessment(tx, assessmentId);
    const course = await assertCanManageCourse(actor, assessment.courseId, tx);
    if (published) {
      const [stats] = await tx
        .select({ n: count(), marks: sql<number>`coalesce(sum(${questions.marks}), 0)::float` })
        .from(assessmentQuestions)
        .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
        .where(eq(assessmentQuestions.assessmentId, assessmentId));
      if ((stats?.n ?? 0) === 0) throw invalid("Add at least one question before publishing.");
    }
    await tx.update(assessments).set({ isPublished: published }).where(eq(assessments.id, assessmentId));
    if (published && !assessment.isPublished && course.status === "published") {
      const learners = await tx
        .select({ id: enrollments.userId })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, course.id), eq(enrollments.status, "active")));
      await notify({
        userIds: learners.map((l) => l.id),
        category: "assessment",
        title: `New ${assessment.kind} in ${course.title}: ${assessment.title}`,
        body: assessment.endsAt ? `Closes ${assessment.endsAt.toUTCString()}.` : undefined,
        link: `/learn/assessments/${assessmentId}`,
      });
    }
    return assessment;
  });
}

async function assertNoAttempts(conn: DbOrTx, assessmentId: string) {
  const [attempted] = await conn
    .select({ n: count() })
    .from(assessmentAttempts)
    .where(eq(assessmentAttempts.assessmentId, assessmentId));
  if ((attempted?.n ?? 0) > 0) {
    throw conflict("Questions cannot be changed after learners have started this assessment.");
  }
}

/** Writes a new question into the course bank and adds it to the assessment. */
export async function addNewQuestion(actor: Actor, assessmentId: string, input: QuestionInput) {
  assertCan(actor, "question_bank.manage");
  const data = questionSchema.parse(input);
  return db.transaction(async (tx) => {
    const assessment = await loadAssessment(tx, assessmentId);
    await assertCanManageCourse(actor, assessment.courseId, tx);
    await assertNoAttempts(tx, assessmentId);
    const bank = await courseBank(tx, actor, assessment.courseId);
    const questionId = await writeQuestion(tx, bank.id, null, data);
    const [last] = await tx
      .select({ max: sql<number>`coalesce(max(${assessmentQuestions.position}), -1)::int` })
      .from(assessmentQuestions)
      .where(eq(assessmentQuestions.assessmentId, assessmentId));
    await tx.insert(assessmentQuestions).values({ assessmentId, questionId: questionId!, position: (last?.max ?? -1) + 1 });
    return assessment;
  });
}

/** Reuses existing bank questions in an assessment. */
export async function addBankQuestions(actor: Actor, assessmentId: string, questionIds: string[]) {
  const ids = z.array(z.string().uuid()).min(1).max(200).parse(questionIds);
  const assessment = await loadAssessment(db, assessmentId);
  await assertCanManageCourse(actor, assessment.courseId);
  await assertNoAttempts(db, assessmentId);
  const rows = await db.select({ id: questions.id, bankId: questions.bankId }).from(questions).where(inArray(questions.id, ids));
  if (rows.length !== ids.length) throw invalid("Some of the selected questions no longer exist.");
  for (const bankId of new Set(rows.map((r) => r.bankId))) await assertBankAccess(actor, bankId);
  const [last] = await db
    .select({ max: sql<number>`coalesce(max(${assessmentQuestions.position}), -1)::int` })
    .from(assessmentQuestions)
    .where(eq(assessmentQuestions.assessmentId, assessmentId));
  await db
    .insert(assessmentQuestions)
    .values(ids.map((questionId, i) => ({ assessmentId, questionId, position: (last?.max ?? -1) + 1 + i })))
    .onConflictDoNothing();
  return assessment;
}

export async function removeQuestionFromAssessment(actor: Actor, assessmentId: string, questionId: string) {
  const assessment = await loadAssessment(db, assessmentId);
  await assertCanManageCourse(actor, assessment.courseId);
  await assertNoAttempts(db, assessmentId);
  await db
    .delete(assessmentQuestions)
    .where(and(eq(assessmentQuestions.assessmentId, assessmentId), eq(assessmentQuestions.questionId, questionId)));
  return assessment;
}

export async function reorderAssessmentQuestions(actor: Actor, assessmentId: string, orderedIds: string[]) {
  const ids = z.array(z.string().uuid()).max(500).parse(orderedIds);
  const assessment = await loadAssessment(db, assessmentId);
  await assertCanManageCourse(actor, assessment.courseId);
  await db.transaction(async (tx) => {
    for (const [position, questionId] of ids.entries()) {
      await tx
        .update(assessmentQuestions)
        .set({ position })
        .where(and(eq(assessmentQuestions.assessmentId, assessmentId), eq(assessmentQuestions.questionId, questionId)));
    }
  });
}

async function loadAssessmentQuestions(conn: DbOrTx, assessmentId: string) {
  const rows = await conn
    .select({ question: questions, position: assessmentQuestions.position })
    .from(assessmentQuestions)
    .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
    .where(eq(assessmentQuestions.assessmentId, assessmentId))
    .orderBy(asc(assessmentQuestions.position));
  const ids = rows.map((r) => r.question.id);
  const options =
    ids.length === 0
      ? []
      : await conn
          .select()
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, ids))
          .orderBy(asc(questionOptions.position));
  return rows.map((r) => ({ ...r.question, options: options.filter((o) => o.questionId === r.question.id) }));
}

/** Full detail including correct answers. Teaching team only. */
export async function getAssessmentForEditing(actor: Actor, assessmentId: string) {
  const assessment = await loadAssessment(db, assessmentId);
  const course = await assertCanManageCourse(actor, assessment.courseId);
  const [questionRows, [attemptStats]] = await Promise.all([
    loadAssessmentQuestions(db, assessmentId),
    db.select({ n: count() }).from(assessmentAttempts).where(eq(assessmentAttempts.assessmentId, assessmentId)),
  ]);
  return { assessment, course, questions: questionRows, attemptCount: attemptStats?.n ?? 0 };
}

// ===========================================================================
// Attempts (learner)
// ===========================================================================

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The learner must hold an active (or completed) enrollment in an available course. */
async function assertLearnerCanSee(conn: DbOrTx, actor: Actor, assessment: Assessment) {
  const [course] = await conn.select().from(courses).where(eq(courses.id, assessment.courseId));
  const available =
    !!course && (LEARNER_VISIBLE_COURSE_STATUSES as readonly string[]).includes(course.status) && assessment.isPublished;
  if (!available) throw notFound("The assessment");
  const [enrollment] = await conn
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, actor.id), eq(enrollments.courseId, assessment.courseId)));
  if (!enrollment || (enrollment.status !== "active" && enrollment.status !== "completed")) {
    throw forbidden("Enroll in this course to take its assessments.");
  }
  return { course: course!, enrollment };
}

export type StartBlocker = "not_open" | "closed" | "no_attempts_left" | null;

export function startBlocker(assessment: Assessment, attemptsUsed: number, now = new Date()): StartBlocker {
  if (assessment.startsAt && now < assessment.startsAt) return "not_open";
  if (assessment.endsAt && now >= assessment.endsAt) return "closed";
  if (attemptsUsed >= assessment.maxAttempts) return "no_attempts_left";
  return null;
}

export async function getAssessmentOverview(actor: Actor, assessmentId: string) {
  assertSignedIn(actor);
  const assessment = await loadAssessment(db, assessmentId);
  const { course } = await assertLearnerCanSee(db, actor, assessment);
  await finalizeExpiredAttempts({ userId: actor.id, assessmentId });
  const [attempts, [stats]] = await Promise.all([
    db
      .select()
      .from(assessmentAttempts)
      .where(and(eq(assessmentAttempts.assessmentId, assessmentId), eq(assessmentAttempts.userId, actor.id)))
      .orderBy(asc(assessmentAttempts.attemptNumber)),
    db
      .select({ n: count(), marks: sql<number>`coalesce(sum(${questions.marks}), 0)::float` })
      .from(assessmentQuestions)
      .innerJoin(questions, eq(questions.id, assessmentQuestions.questionId))
      .where(eq(assessmentQuestions.assessmentId, assessmentId)),
  ]);
  const inProgress = attempts.find((a) => a.status === "in_progress") ?? null;
  return {
    assessment,
    course,
    // Scores stay hidden until the instructor's release policy allows them.
    attempts: attempts.map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      released: a.releasedAt !== null,
      percent: a.releasedAt ? a.percent : null,
      passed: a.releasedAt ? a.passed : null,
    })),
    inProgress,
    questionCount: stats?.n ?? 0,
    totalMarks: stats?.marks ?? 0,
    blocker: inProgress ? null : startBlocker(assessment, attempts.length),
  };
}

/**
 * Starts a new attempt, or returns the one already in progress. Attempt
 * limits and the availability window are enforced here, on the server.
 */
export async function startAttempt(actor: Actor, assessmentId: string) {
  assertSignedIn(actor);
  await finalizeExpiredAttempts({ userId: actor.id, assessmentId });
  return db.transaction(async (tx) => {
    const assessment = await loadAssessment(tx, assessmentId);
    const { enrollment } = await assertLearnerCanSee(tx, actor, assessment);
    // Serialise concurrent starts by this learner in this course.
    await tx.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.id, enrollment.id)).for("update");

    const existing = await tx
      .select()
      .from(assessmentAttempts)
      .where(and(eq(assessmentAttempts.assessmentId, assessmentId), eq(assessmentAttempts.userId, actor.id)));
    const open = existing.find((a) => a.status === "in_progress");
    if (open) return open;

    const now = new Date();
    const blocker = startBlocker(assessment, existing.length, now);
    if (blocker === "not_open") throw conflict("This assessment has not opened yet.");
    if (blocker === "closed") throw conflict("This assessment has closed.");
    if (blocker === "no_attempts_left") throw conflict("You have used all of your attempts.");

    const questionRows = await loadAssessmentQuestions(tx, assessmentId);
    if (questionRows.length === 0) throw conflict("This assessment has no questions yet.");
    const ordered = assessment.shuffleQuestions ? shuffle(questionRows) : questionRows;
    const optionOrder: Record<string, string[]> = {};
    for (const q of ordered) {
      const ids = q.options.map((o) => o.id);
      optionOrder[q.id] = assessment.shuffleOptions && q.type !== "true_false" ? shuffle(ids) : ids;
    }
    const limitEnd = assessment.timeLimitMinutes ? new Date(now.getTime() + assessment.timeLimitMinutes * 60_000) : null;
    const deadlineAt =
      limitEnd && assessment.endsAt
        ? new Date(Math.min(limitEnd.getTime(), assessment.endsAt.getTime()))
        : (limitEnd ?? assessment.endsAt ?? null);

    const [attempt] = await tx
      .insert(assessmentAttempts)
      .values({
        assessmentId,
        userId: actor.id,
        attemptNumber: existing.length + 1,
        layout: { questionIds: ordered.map((q) => q.id), optionOrder },
        startedAt: now,
        deadlineAt,
        maxScore: roundMarks(questionRows.reduce((sum, q) => sum + q.marks, 0)),
      })
      .returning();
    return attempt!;
  });
}

async function loadOwnAttempt(conn: DbOrTx, actor: Actor, attemptId: string, lock = false) {
  const query = conn.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId));
  const [attempt] = lock ? await query.for("update") : await query;
  // Another learner's attempt is indistinguishable from a missing one.
  if (!attempt || attempt.userId !== actor.id) throw notFound("The attempt");
  return attempt;
}

export type LearnerQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  options: { id: string; text: string }[];
};

/**
 * Everything the exam screen needs. Correct answers, accepted answers and
 * explanations are deliberately absent from this payload.
 */
export async function getAttemptForTaking(actor: Actor, attemptId: string) {
  assertSignedIn(actor);
  let attempt = await loadOwnAttempt(db, actor, attemptId);
  if (attempt.status === "in_progress" && attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
    await finalizeAttemptById(attemptId, true);
    attempt = await loadOwnAttempt(db, actor, attemptId);
  }
  const assessment = await loadAssessment(db, attempt.assessmentId);
  if (attempt.status !== "in_progress") return { attempt, assessment, questions: [], answers: [] };

  const ids = attempt.layout.questionIds;
  const [questionRows, optionRows, answers] = await Promise.all([
    db.select().from(questions).where(inArray(questions.id, ids)),
    db
      .select({ id: questionOptions.id, questionId: questionOptions.questionId, text: questionOptions.text })
      .from(questionOptions)
      .where(inArray(questionOptions.questionId, ids)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
  ]);
  const learnerQuestions: LearnerQuestion[] = [];
  for (const id of ids) {
    const q = questionRows.find((r) => r.id === id);
    if (!q) continue;
    const order = attempt.layout.optionOrder[id] ?? [];
    const options = order
      .map((optionId) => optionRows.find((o) => o.id === optionId))
      .filter((o): o is NonNullable<typeof o> => !!o)
      .map((o) => ({ id: o.id, text: o.text }));
    learnerQuestions.push({ id: q.id, type: q.type, text: q.text, marks: q.marks, options });
  }
  return {
    attempt,
    assessment,
    questions: learnerQuestions,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      selectedOptionIds: a.selectedOptionIds,
      textAnswer: a.textAnswer ?? "",
      fileId: a.fileId,
    })),
  };
}

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIds: z.array(z.string().uuid()).max(12).default([]),
  textAnswer: z.string().max(50_000).default(""),
  fileId: z.string().uuid().nullable().default(null),
});

/** Autosave for one answer. Rejected once the attempt is closed or past its deadline. */
export async function saveAnswer(actor: Actor, attemptId: string, input: z.input<typeof answerSchema>) {
  assertSignedIn(actor);
  const data = answerSchema.parse(input);
  const attempt = await loadOwnAttempt(db, actor, attemptId);
  if (attempt.status !== "in_progress") throw conflict("This attempt has already been submitted.");
  if (attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
    await logAudit(db, {
      actorId: actor.id,
      action: "attempt.late_save_rejected",
      entityType: "assessment_attempt",
      entityId: attemptId,
    });
    await finalizeAttemptById(attemptId, true);
    throw conflict("Time is up. Your saved answers have been submitted.");
  }
  if (!attempt.layout.questionIds.includes(data.questionId)) throw invalid("That question is not part of this attempt.");
  const [question] = await db.select().from(questions).where(eq(questions.id, data.questionId));
  if (!question) throw notFound("The question");

  let selected: string[] = [];
  if (OPTION_TYPES.includes(question.type)) {
    const allowed = new Set(attempt.layout.optionOrder[question.id] ?? []);
    selected = [...new Set(data.selectedOptionIds)].filter((id) => allowed.has(id));
    if (question.type !== "multiple_select") selected = selected.slice(0, 1);
  }
  let fileId: string | null = null;
  if (question.type === "file_upload" && data.fileId) {
    const [file] = await db.select().from(schema.files).where(eq(schema.files.id, data.fileId));
    if (!file || file.uploadedBy !== actor.id || file.purpose !== "submission") {
      throw invalid("That file cannot be attached to this answer.");
    }
    fileId = file.id;
  }
  const textAnswer = question.type === "short_answer" || question.type === "essay" ? data.textAnswer : null;
  const now = new Date();
  await db
    .insert(attemptAnswers)
    .values({ attemptId, questionId: question.id, selectedOptionIds: selected, textAnswer, fileId, savedAt: now })
    .onConflictDoUpdate({
      target: [attemptAnswers.attemptId, attemptAnswers.questionId],
      set: { selectedOptionIds: selected, textAnswer, fileId, savedAt: now },
    });
  return { savedAt: now };
}

// --- Scoring ---------------------------------------------------------------

type GradableQuestion = Question & { options: QuestionOption[] };
type AnswerLike = { selectedOptionIds: string[]; textAnswer: string | null; fileId: string | null };

export type AutoGrade = { marks: number | null; needsManual: boolean };

/**
 * Grades one answer. Objective questions are scored here on the server;
 * essays, file uploads and short answers without accepted answers are left
 * for a human (marks = null). Unanswered questions always score zero.
 */
export function gradeAnswer(question: GradableQuestion, answer: AnswerLike | undefined, negativePercent: number): AutoGrade {
  const penalty = negativePercent > 0 ? -roundMarks((question.marks * negativePercent) / 100) : 0;
  if (question.type === "multiple_choice" || question.type === "true_false" || question.type === "multiple_select") {
    const selected = new Set(answer?.selectedOptionIds ?? []);
    if (selected.size === 0) return { marks: 0, needsManual: false };
    const correct = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
    const exact = selected.size === correct.size && [...selected].every((id) => correct.has(id));
    return { marks: exact ? question.marks : penalty, needsManual: false };
  }
  if (question.type === "short_answer") {
    const given = (answer?.textAnswer ?? "").trim();
    if (given === "") return { marks: 0, needsManual: false };
    if (question.acceptedAnswers.length === 0) return { marks: null, needsManual: true };
    const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const match = question.acceptedAnswers.some((a) => normal(a) === normal(given));
    return { marks: match ? question.marks : penalty, needsManual: false };
  }
  const answered = question.type === "essay" ? (answer?.textAnswer ?? "").trim() !== "" : !!answer?.fileId;
  return answered ? { marks: null, needsManual: true } : { marks: 0, needsManual: false };
}

function totals(marks: number[], maxScore: number, passMarkPercent: number) {
  const score = Math.max(0, roundMarks(marks.reduce((a, b) => a + b, 0)));
  const percent = maxScore > 0 ? roundMarks((score / maxScore) * 100) : 0;
  return { score, percent, passed: percent >= passMarkPercent };
}

async function afterGraded(tx: Tx, notify: Notify, attempt: Attempt, assessment: Assessment, released: boolean, percent: number) {
  if (!released) return;
  await notify({
    userIds: [attempt.userId],
    category: "grade",
    title: `Results available: ${assessment.title}`,
    link: `/learn/attempts/${attempt.id}/result`,
  });
  if (percent >= 100) await awardBadge(tx, attempt.userId, "perfect_score");
  await evaluateCompletion(tx, notify, attempt.userId, assessment.courseId);
}

/**
 * Closes an attempt and scores it inside one transaction. The row lock makes
 * this safe against double submission and against a submit racing the
 * automatic deadline close.
 */
async function finalizeAttempt(tx: Tx, notify: Notify, attemptId: string, auto: boolean) {
  const [attempt] = await tx.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId)).for("update");
  if (!attempt || attempt.status !== "in_progress") return attempt ?? null;
  const assessment = await loadAssessment(tx, attempt.assessmentId);
  const questionRows = (await loadAssessmentQuestions(tx, attempt.assessmentId)).filter((q) =>
    attempt.layout.questionIds.includes(q.id),
  );
  const answers = await tx.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  const now = new Date();

  let pendingManual = false;
  const awarded: number[] = [];
  for (const question of questionRows) {
    const answer = answers.find((a) => a.questionId === question.id);
    const result = gradeAnswer(question, answer, assessment.negativeMarkingPercent);
    if (result.needsManual) pendingManual = true;
    else awarded.push(result.marks ?? 0);
    await tx
      .insert(attemptAnswers)
      .values({
        attemptId,
        questionId: question.id,
        selectedOptionIds: answer?.selectedOptionIds ?? [],
        textAnswer: answer?.textAnswer ?? null,
        fileId: answer?.fileId ?? null,
        awardedMarks: result.marks,
        needsManualGrading: result.needsManual,
        savedAt: answer?.savedAt ?? now,
      })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.questionId],
        set: { awardedMarks: result.marks, needsManualGrading: result.needsManual },
      });
  }

  const base = { submittedAt: now, autoSubmitted: auto };
  if (pendingManual) {
    const [updated] = await tx
      .update(assessmentAttempts)
      .set({ ...base, status: "submitted" })
      .where(eq(assessmentAttempts.id, attemptId))
      .returning();
    await notify({
      userIds: [attempt.userId],
      category: "submission",
      title: `Submission received: ${assessment.title}`,
      body: "Some answers need to be marked by your instructor.",
      link: `/learn/attempts/${attemptId}/result`,
    });
    return updated!;
  }

  const result = totals(awarded, attempt.maxScore, assessment.passMarkPercent);
  const released = assessment.resultRelease === "immediate";
  const [updated] = await tx
    .update(assessmentAttempts)
    .set({ ...base, ...result, status: "graded", gradedAt: now, releasedAt: released ? now : null })
    .where(eq(assessmentAttempts.id, attemptId))
    .returning();
  await recordActivity(tx, {
    userId: attempt.userId,
    courseId: assessment.courseId,
    type: "assessment_submitted",
    summary: `Submitted ${assessment.kind}: ${assessment.title}`,
    link: `/learn/attempts/${attemptId}/result`,
  });
  if (auto) {
    await logAudit(tx, {
      actorId: attempt.userId,
      action: "attempt.auto_submitted",
      entityType: "assessment_attempt",
      entityId: attemptId,
    });
  }
  await afterGraded(tx, notify, updated!, assessment, released, result.percent);
  return updated!;
}

async function finalizeAttemptById(attemptId: string, auto: boolean) {
  return withNotifications((tx, notify) => finalizeAttempt(tx, notify, attemptId, auto));
}

/**
 * Interrupted-attempt policy: the timer keeps running on the server. Answers
 * are saved as the learner works, the learner may resume until the deadline,
 * and once it passes the attempt is closed with whatever was saved.
 */
export async function finalizeExpiredAttempts(filter: { userId?: string; assessmentId?: string }) {
  const cutoff = new Date(Date.now() - DEADLINE_GRACE_MS);
  const conditions = [eq(assessmentAttempts.status, "in_progress"), lt(assessmentAttempts.deadlineAt, cutoff)];
  if (filter.userId) conditions.push(eq(assessmentAttempts.userId, filter.userId));
  if (filter.assessmentId) conditions.push(eq(assessmentAttempts.assessmentId, filter.assessmentId));
  const expired = await db
    .select({ id: assessmentAttempts.id })
    .from(assessmentAttempts)
    .where(and(...conditions))
    .limit(200);
  for (const row of expired) await finalizeAttemptById(row.id, true);
  return expired.length;
}

export async function submitAttempt(actor: Actor, attemptId: string) {
  assertSignedIn(actor);
  const attempt = await loadOwnAttempt(db, actor, attemptId);
  if (attempt.status !== "in_progress") return attempt;
  const late = !!attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS;
  return (await finalizeAttemptById(attemptId, late))!;
}

/** What a learner may see of a finished attempt, honouring the release policy. */
export async function getAttemptResult(actor: Actor, attemptId: string) {
  assertSignedIn(actor);
  const attempt = await loadOwnAttempt(db, actor, attemptId);
  const assessment = await loadAssessment(db, attempt.assessmentId);
  const [course] = await db
    .select({ slug: courses.slug, title: courses.title })
    .from(courses)
    .where(eq(courses.id, assessment.courseId));
  const summary = {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    autoSubmitted: attempt.autoSubmitted,
  };
  const released = attempt.status === "graded" && attempt.releasedAt !== null;
  if (!released) {
    return { released: false as const, attempt: summary, assessment, course: course! };
  }
  const questionRows = await loadAssessmentQuestions(db, assessment.id);
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
  const reveal = assessment.showCorrectAnswers;
  const review = attempt.layout.questionIds
    .map((id) => questionRows.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      const order = attempt.layout.optionOrder[q.id] ?? q.options.map((o) => o.id);
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        marks: q.marks,
        awardedMarks: answer?.awardedMarks ?? 0,
        feedback: answer?.feedback ?? null,
        textAnswer: answer?.textAnswer ?? null,
        fileId: answer?.fileId ?? null,
        selectedOptionIds: answer?.selectedOptionIds ?? [],
        options: order
          .map((optionId) => q.options.find((o) => o.id === optionId))
          .filter((o): o is QuestionOption => !!o)
          .map((o) => ({ id: o.id, text: o.text, isCorrect: reveal ? o.isCorrect : null })),
        explanation: reveal ? q.explanation : null,
        acceptedAnswers: reveal ? q.acceptedAnswers : null,
      };
    });
  return {
    released: true as const,
    attempt: {
      ...summary,
      score: attempt.score,
      maxScore: attempt.maxScore,
      percent: attempt.percent,
      passed: attempt.passed,
      feedback: attempt.feedback,
    },
    assessment,
    course: course!,
    review,
  };
}

// ===========================================================================
// Grading (instructor)
// ===========================================================================

export async function listAttemptsForAssessment(actor: Actor, assessmentId: string) {
  assertCan(actor, "grading.manage");
  const assessment = await loadAssessment(db, assessmentId);
  await assertCanManageCourse(actor, assessment.courseId);
  await finalizeExpiredAttempts({ assessmentId });
  const rows = await db
    .select({ attempt: assessmentAttempts, learnerName: users.name, learnerEmail: users.email })
    .from(assessmentAttempts)
    .innerJoin(users, eq(users.id, assessmentAttempts.userId))
    .where(eq(assessmentAttempts.assessmentId, assessmentId))
    .orderBy(desc(assessmentAttempts.startedAt));
  return { assessment, rows };
}

export async function getAttemptForGrading(actor: Actor, attemptId: string) {
  assertCan(actor, "grading.manage");
  const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId));
  if (!attempt) throw notFound("The attempt");
  const assessment = await loadAssessment(db, attempt.assessmentId);
  const course = await assertCanManageCourse(actor, assessment.courseId);
  const [[learner], questionRows, answers] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, attempt.userId)),
    loadAssessmentQuestions(db, assessment.id),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
  ]);
  const items = attempt.layout.questionIds
    .map((id) => questionRows.find((q) => q.id === id))
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => ({ question: q, answer: answers.find((a) => a.questionId === q.id) ?? null }));
  return { attempt, assessment, course, learner: learner!, items };
}

export const gradeAttemptSchema = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        marks: z.number().min(0).max(1000),
        feedback: z.string().trim().max(5000).default(""),
      }),
    )
    .max(500),
  feedback: z.string().trim().max(10000).default(""),
});

/**
 * Records marks for the manually graded answers and finalises the attempt.
 * Every answer that needs a human mark must be included.
 */
export async function gradeAttempt(actor: Actor, attemptId: string, input: z.input<typeof gradeAttemptSchema>) {
  assertCan(actor, "grading.manage");
  const data = gradeAttemptSchema.parse(input);
  return withNotifications(async (tx, notify) => {
    const [attempt] = await tx.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId)).for("update");
    if (!attempt) throw notFound("The attempt");
    const assessment = await loadAssessment(tx, attempt.assessmentId);
    await assertCanManageCourse(actor, assessment.courseId, tx);
    if (attempt.status === "in_progress") throw conflict("The learner has not submitted this attempt yet.");

    const questionRows = await loadAssessmentQuestions(tx, assessment.id);
    const answers = await tx.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
    for (const grade of data.grades) {
      const question = questionRows.find((q) => q.id === grade.questionId);
      const answer = answers.find((a) => a.questionId === grade.questionId);
      if (!question || !answer) throw invalid("One of the graded questions is not part of this attempt.");
      if (!answer.needsManualGrading) continue; // objective marks are never overwritten by hand
      if (grade.marks > question.marks) {
        throw invalid(`Marks for "${question.text.slice(0, 40)}" cannot exceed ${question.marks}.`);
      }
      await tx
        .update(attemptAnswers)
        .set({ awardedMarks: roundMarks(grade.marks), feedback: grade.feedback || null })
        .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, grade.questionId)));
      answer.awardedMarks = roundMarks(grade.marks);
    }
    const outstanding = answers.filter((a) => a.needsManualGrading && a.awardedMarks === null);
    if (outstanding.length > 0) {
      throw invalid(`Enter marks for all ${outstanding.length} remaining answer(s) before finalising.`);
    }
    const result = totals(answers.map((a) => a.awardedMarks ?? 0), attempt.maxScore, assessment.passMarkPercent);
    const now = new Date();
    const released = assessment.resultRelease === "immediate" || attempt.releasedAt !== null;
    const [updated] = await tx
      .update(assessmentAttempts)
      .set({
        ...result,
        status: "graded",
        feedback: data.feedback || null,
        gradedBy: actor.id,
        gradedAt: now,
        releasedAt: released ? (attempt.releasedAt ?? now) : null,
      })
      .where(eq(assessmentAttempts.id, attemptId))
      .returning();
    await logAudit(tx, {
      actorId: actor.id,
      action: "attempt.grade",
      entityType: "assessment_attempt",
      entityId: attemptId,
      metadata: { score: result.score, maxScore: attempt.maxScore },
    });
    await afterGraded(tx, notify, updated!, assessment, released, result.percent);
    return { attempt: updated!, assessment };
  });
}

/** Publishes held results (manual release policy) for every graded attempt. */
export async function releaseResults(actor: Actor, assessmentId: string) {
  assertCan(actor, "grading.manage");
  return withNotifications(async (tx, notify) => {
    const assessment = await loadAssessment(tx, assessmentId);
    await assertCanManageCourse(actor, assessment.courseId, tx);
    const held = await tx
      .select()
      .from(assessmentAttempts)
      .where(
        and(
          eq(assessmentAttempts.assessmentId, assessmentId),
          eq(assessmentAttempts.status, "graded"),
          isNull(assessmentAttempts.releasedAt),
        ),
      )
      .for("update");
    const now = new Date();
    for (const attempt of held) {
      await tx.update(assessmentAttempts).set({ releasedAt: now }).where(eq(assessmentAttempts.id, attempt.id));
      await afterGraded(tx, notify, attempt, assessment, true, attempt.percent ?? 0);
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: "assessment.release_results",
      entityType: "assessment",
      entityId: assessmentId,
      metadata: { attempts: held.length },
    });
    return { released: held.length, assessment };
  });
}

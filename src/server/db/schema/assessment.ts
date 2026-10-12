import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, files, lessons } from "./catalog";
import { createdAt, id, ts, updatedAt } from "./_shared";

export const questionType = pgEnum("question_type", [
  "multiple_choice", // one correct option ("single answer")
  "multiple_select", // several correct options, all-or-nothing
  "true_false",
  "short_answer", // auto-graded when accepted answers are configured
  "essay", // manual grading
  "file_upload", // manual grading
]);

export const questionBanks = pgTable(
  "question_banks",
  {
    id: id(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** When set, every instructor of this course may reuse the bank. */
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("question_banks_owner_idx").on(t.ownerId),
    index("question_banks_course_idx").on(t.courseId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: id(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => questionBanks.id, { onDelete: "cascade" }),
    type: questionType("type").notNull(),
    text: text("text").notNull(),
    explanation: text("explanation").notNull().default(""),
    marks: doublePrecision("marks").notNull().default(1),
    mediaFileId: uuid("media_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    /** Accepted answers for short-answer questions (compared case-insensitively). */
    acceptedAnswers: jsonb("accepted_answers").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("questions_bank_idx").on(t.bankId)],
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: id(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** Never sent to a learner before results are released. */
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("question_options_question_idx").on(t.questionId)],
);

export const assessmentKind = pgEnum("assessment_kind", ["quiz", "exam"]);
export const resultRelease = pgEnum("result_release", ["immediate", "manual"]);

export const assessments = pgTable(
  "assessments",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    kind: assessmentKind("kind").notNull().default("quiz"),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    timeLimitMinutes: integer("time_limit_minutes"),
    passMarkPercent: integer("pass_mark_percent").notNull().default(50),
    maxAttempts: integer("max_attempts").notNull().default(1),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    shuffleOptions: boolean("shuffle_options").notNull().default(false),
    /** Percentage of a question's marks deducted for a wrong objective answer. */
    negativeMarkingPercent: integer("negative_marking_percent").notNull().default(0),
    resultRelease: resultRelease("result_release").notNull().default("immediate"),
    showCorrectAnswers: boolean("show_correct_answers").notNull().default(false),
    requiredForCompletion: boolean("required_for_completion").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("assessments_course_idx").on(t.courseId)],
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.questionId] })],
);

export const attemptStatus = pgEnum("attempt_status", [
  "in_progress",
  "submitted", // waiting for manual grading
  "graded",
]);

export type AttemptLayout = {
  /** Question ids in the order shown to this learner. */
  questionIds: string[];
  /** Option ids per question in the order shown to this learner. */
  optionOrder: Record<string, string[]>;
};

export const assessmentAttempts = pgTable(
  "assessment_attempts",
  {
    id: id(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    status: attemptStatus("status").notNull().default("in_progress"),
    layout: jsonb("layout").$type<AttemptLayout>().notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    /** Server-computed hard deadline (time limit and/or assessment end). */
    deadlineAt: ts("deadline_at"),
    submittedAt: ts("submitted_at"),
    /** True when the server closed the attempt after the deadline passed. */
    autoSubmitted: boolean("auto_submitted").notNull().default(false),
    score: doublePrecision("score"),
    maxScore: doublePrecision("max_score").notNull().default(0),
    percent: doublePrecision("percent"),
    passed: boolean("passed"),
    feedback: text("feedback"),
    gradedBy: uuid("graded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    gradedAt: ts("graded_at"),
    /** Results are visible to the learner only once this is set. */
    releasedAt: ts("released_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("attempts_unique_number_idx").on(
      t.assessmentId,
      t.userId,
      t.attemptNumber,
    ),
    index("attempts_user_idx").on(t.userId),
    index("attempts_status_idx").on(t.assessmentId, t.status),
  ],
);

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => assessmentAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedOptionIds: jsonb("selected_option_ids").$type<string[]>().notNull().default([]),
    textAnswer: text("text_answer"),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
    /** Null while a manually graded answer is waiting for a mark. */
    awardedMarks: doublePrecision("awarded_marks"),
    needsManualGrading: boolean("needs_manual_grading").notNull().default(false),
    feedback: text("feedback"),
    savedAt: ts("saved_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.questionId] })],
);

// --- Assignments -----------------------------------------------------------

export const latePolicy = pgEnum("late_policy", ["reject", "accept", "penalty"]);

export const assignments = pgTable(
  "assignments",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    dueAt: ts("due_at"),
    maxMarks: doublePrecision("max_marks").notNull().default(100),
    passMarkPercent: integer("pass_mark_percent").notNull().default(50),
    allowText: boolean("allow_text").notNull().default(true),
    allowFiles: boolean("allow_files").notNull().default(true),
    /** Lower-case extensions without the dot, e.g. ["pdf", "docx"]. */
    allowedExtensions: jsonb("allowed_extensions").$type<string[]>().notNull().default([]),
    maxFiles: integer("max_files").notNull().default(3),
    latePolicy: latePolicy("late_policy").notNull().default("accept"),
    latePenaltyPercent: integer("late_penalty_percent").notNull().default(0),
    allowResubmission: boolean("allow_resubmission").notNull().default(true),
    requiredForCompletion: boolean("required_for_completion").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("assignments_course_idx").on(t.courseId)],
);

export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "submitted",
  "graded",
]);

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: id(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: submissionStatus("status").notNull().default("draft"),
    textResponse: text("text_response").notNull().default(""),
    submittedAt: ts("submitted_at"),
    isLate: boolean("is_late").notNull().default(false),
    submissionCount: integer("submission_count").notNull().default(0),
    /** Mark after any late penalty has been applied. */
    marks: doublePrecision("marks"),
    feedback: text("feedback"),
    gradedBy: uuid("graded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    gradedAt: ts("graded_at"),
    /** Grade and feedback are visible to the learner only once this is set. */
    releasedAt: ts("released_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("submissions_unique_idx").on(t.assignmentId, t.userId),
    index("submissions_status_idx").on(t.assignmentId, t.status),
  ],
);

export const submissionFiles = pgTable(
  "submission_files",
  {
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.submissionId, t.fileId] })],
);

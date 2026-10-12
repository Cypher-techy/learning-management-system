import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import type { Actor } from "@/server/permissions";
import {
  addNewQuestion,
  createAssessment,
  getAssessmentOverview,
  getAttemptForGrading,
  getAttemptForTaking,
  getAttemptResult,
  gradeAttempt,
  releaseResults,
  saveAnswer,
  setAssessmentPublished,
  startAttempt,
  submitAttempt,
  type AssessmentInput,
} from "@/server/services/assessments";
import { enrollInFreeCourse } from "@/server/services/enrollment";
import { setLessonCompleted } from "@/server/services/progress";
import { expectAppError, makeCourse, makeUser, type CourseFixture } from "../helpers";

const base: AssessmentInput = {
  kind: "quiz",
  title: "Unit quiz",
  passMarkPercent: 50,
  maxAttempts: 2,
  resultRelease: "immediate",
  showCorrectAnswers: false,
};

let instructor: Actor;
let otherInstructor: Actor;
let fixture: CourseFixture;

beforeAll(async () => {
  instructor = await makeUser("instructor");
  otherInstructor = await makeUser("instructor");
  fixture = await makeCourse(instructor, { lessons: 1 });
});

async function buildAssessment(overrides: Partial<AssessmentInput> = {}, withEssay = false) {
  const assessment = await createAssessment(instructor, fixture.course.id, { ...base, ...overrides });
  await addNewQuestion(instructor, assessment.id, {
    type: "multiple_choice",
    text: "2 + 2 = ?",
    marks: 2,
    options: [
      { text: "3", isCorrect: false },
      { text: "4", isCorrect: true },
      { text: "5", isCorrect: false },
    ],
  });
  await addNewQuestion(instructor, assessment.id, {
    type: "multiple_select",
    text: "Select the even numbers",
    marks: 2,
    options: [
      { text: "2", isCorrect: true },
      { text: "3", isCorrect: false },
      { text: "4", isCorrect: true },
    ],
  });
  await addNewQuestion(instructor, assessment.id, {
    type: "true_false",
    text: "The sky is green.",
    marks: 1,
    options: [
      { text: "True", isCorrect: false },
      { text: "False", isCorrect: true },
    ],
  });
  await addNewQuestion(instructor, assessment.id, {
    type: "short_answer",
    text: "Capital of Kenya?",
    marks: 1,
    acceptedAnswers: ["Nairobi"],
  });
  if (withEssay) {
    await addNewQuestion(instructor, assessment.id, { type: "essay", text: "Explain photosynthesis.", marks: 4 });
  }
  await setAssessmentPublished(instructor, assessment.id, true);
  return assessment;
}

async function enrolledStudent() {
  const student = await makeUser("student");
  await enrollInFreeCourse(student, fixture.course.id);
  return student;
}

/** Answers every objective question, correctly or not, via the autosave endpoint. */
async function answerAll(student: Actor, attemptId: string, correct: boolean, essay?: string) {
  const view = await getAttemptForTaking(student, attemptId);
  for (const q of view.questions) {
    const options = await db.select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, q.id));
    if (q.type === "essay") {
      if (essay) await saveAnswer(student, attemptId, { questionId: q.id, textAnswer: essay });
    } else if (q.type === "short_answer") {
      await saveAnswer(student, attemptId, { questionId: q.id, textAnswer: correct ? "  nairobi " : "Mombasa" });
    } else {
      const pick = options.filter((o) => o.isCorrect === correct).map((o) => o.id);
      await saveAnswer(student, attemptId, {
        questionId: q.id,
        selectedOptionIds: q.type === "multiple_select" ? pick : pick.slice(0, 1),
      });
    }
  }
}

describe("taking an assessment", () => {
  it("never sends correct answers to the learner during an attempt", async () => {
    const assessment = await buildAssessment();
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    const view = await getAttemptForTaking(student, attempt.id);
    expect(view.questions).toHaveLength(4);
    const payload = JSON.stringify(view.questions);
    expect(payload).not.toContain("isCorrect");
    expect(payload).not.toContain("acceptedAnswers");
    expect(payload).not.toContain("Nairobi");
    expect(payload).not.toContain("explanation");
  });

  it("saves answers so an interrupted attempt can be resumed", async () => {
    const assessment = await buildAssessment();
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    const first = (await getAttemptForTaking(student, attempt.id)).questions.find((q) => q.type === "multiple_choice")!;
    const chosen = first.options[1]!.id;

    await saveAnswer(student, attempt.id, { questionId: first.id, selectedOptionIds: [chosen] });
    // Overwrite: the latest save wins.
    await saveAnswer(student, attempt.id, { questionId: first.id, selectedOptionIds: [first.options[0]!.id] });
    await saveAnswer(student, attempt.id, { questionId: first.id, selectedOptionIds: [chosen] });

    // Resuming returns the same attempt, with the saved answer intact.
    const resumed = await startAttempt(student, assessment.id);
    expect(resumed.id).toBe(attempt.id);
    const reloaded = await getAttemptForTaking(student, attempt.id);
    expect(reloaded.answers.find((a) => a.questionId === first.id)?.selectedOptionIds).toEqual([chosen]);
  });

  it("ignores option ids that do not belong to the question", async () => {
    const assessment = await buildAssessment();
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    const q = (await getAttemptForTaking(student, attempt.id)).questions[0]!;
    await saveAnswer(student, attempt.id, { questionId: q.id, selectedOptionIds: [crypto.randomUUID()] });
    const view = await getAttemptForTaking(student, attempt.id);
    expect(view.answers.find((a) => a.questionId === q.id)?.selectedOptionIds).toEqual([]);
  });

  it("blocks access to another learner's attempt", async () => {
    const assessment = await buildAssessment();
    const owner = await enrolledStudent();
    const intruder = await enrolledStudent();
    const attempt = await startAttempt(owner, assessment.id);
    const q = (await getAttemptForTaking(owner, attempt.id)).questions[0]!;

    await expectAppError(getAttemptForTaking(intruder, attempt.id), "NOT_FOUND");
    await expectAppError(saveAnswer(intruder, attempt.id, { questionId: q.id, textAnswer: "x" }), "NOT_FOUND");
    await expectAppError(submitAttempt(intruder, attempt.id), "NOT_FOUND");
    await expectAppError(getAttemptResult(intruder, attempt.id), "NOT_FOUND");
  });

  it("requires enrollment", async () => {
    const assessment = await buildAssessment();
    const outsider = await makeUser("student");
    await expectAppError(startAttempt(outsider, assessment.id), "FORBIDDEN");
    await expectAppError(getAssessmentOverview(outsider, assessment.id), "FORBIDDEN");
  });
});

describe("limits enforced on the server", () => {
  it("enforces the maximum number of attempts", async () => {
    const assessment = await buildAssessment({ maxAttempts: 2 });
    const student = await enrolledStudent();
    for (let i = 0; i < 2; i++) {
      const attempt = await startAttempt(student, assessment.id);
      await submitAttempt(student, attempt.id);
    }
    await expectAppError(startAttempt(student, assessment.id), "CONFLICT");
    expect((await getAssessmentOverview(student, assessment.id)).blocker).toBe("no_attempts_left");
    const attempts = await db.select().from(schema.assessmentAttempts).where(eq(schema.assessmentAttempts.userId, student.id));
    expect(attempts).toHaveLength(2);
  });

  it("refuses to start before opening or after closing", async () => {
    const student = await enrolledStudent();
    const future = await buildAssessment({ startsAt: new Date(Date.now() + 3600_000) });
    await expectAppError(startAttempt(student, future.id), "CONFLICT");
    const closed = await buildAssessment({ endsAt: new Date(Date.now() - 60_000) });
    await expectAppError(startAttempt(student, closed.id), "CONFLICT");
  });

  it("rejects saves after the deadline and closes the attempt with what was saved", async () => {
    const assessment = await buildAssessment({ timeLimitMinutes: 30 });
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    expect(attempt.deadlineAt).not.toBeNull();
    const view = await getAttemptForTaking(student, attempt.id);
    const mc = view.questions.find((q) => q.type === "multiple_choice")!;
    const options = await db.select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, mc.id));
    await saveAnswer(student, attempt.id, { questionId: mc.id, selectedOptionIds: [options.find((o) => o.isCorrect)!.id] });

    // Time passes: move the server-side deadline into the past.
    await db
      .update(schema.assessmentAttempts)
      .set({ deadlineAt: new Date(Date.now() - 120_000) })
      .where(eq(schema.assessmentAttempts.id, attempt.id));

    const tf = view.questions.find((q) => q.type === "true_false")!;
    await expectAppError(saveAnswer(student, attempt.id, { questionId: tf.id, selectedOptionIds: [tf.options[0]!.id] }), "CONFLICT");

    const [closed] = await db.select().from(schema.assessmentAttempts).where(eq(schema.assessmentAttempts.id, attempt.id));
    expect(closed!.status).toBe("graded");
    expect(closed!.autoSubmitted).toBe(true);
    // Only the answer saved in time counts: 2 of 6 marks.
    expect(closed!.score).toBe(2);
    await expectAppError(saveAnswer(student, attempt.id, { questionId: tf.id, selectedOptionIds: [] }), "CONFLICT");
  });

  it("caps the deadline at the assessment's closing time", async () => {
    const endsAt = new Date(Date.now() + 5 * 60_000);
    const assessment = await buildAssessment({ timeLimitMinutes: 60, endsAt });
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    expect(attempt.deadlineAt!.getTime()).toBe(endsAt.getTime());
  });
});

describe("automatic grading", () => {
  it("scores objective questions correctly on the server", async () => {
    const assessment = await buildAssessment();
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    await answerAll(student, attempt.id, true);
    const done = await submitAttempt(student, attempt.id);
    expect(done.status).toBe("graded");
    expect(done.score).toBe(6);
    expect(done.maxScore).toBe(6);
    expect(done.percent).toBe(100);
    expect(done.passed).toBe(true);
    expect(done.releasedAt).not.toBeNull();
  });

  it("gives zero for wrong and unanswered questions", async () => {
    const assessment = await buildAssessment();
    const student = await enrolledStudent();
    const wrong = await startAttempt(student, assessment.id);
    await answerAll(student, wrong.id, false);
    const result = await submitAttempt(student, wrong.id);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);

    const blank = await startAttempt(student, assessment.id);
    expect((await submitAttempt(student, blank.id)).score).toBe(0);
  });

  it("applies negative marking without going below zero", async () => {
    const assessment = await buildAssessment({ negativeMarkingPercent: 50 });
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    const view = await getAttemptForTaking(student, attempt.id);
    // One right (2 marks), one wrong (-0.5 of 1 mark), rest blank.
    const mc = view.questions.find((q) => q.type === "multiple_choice")!;
    const tf = view.questions.find((q) => q.type === "true_false")!;
    const mcOptions = await db.select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, mc.id));
    const tfOptions = await db.select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, tf.id));
    await saveAnswer(student, attempt.id, { questionId: mc.id, selectedOptionIds: [mcOptions.find((o) => o.isCorrect)!.id] });
    await saveAnswer(student, attempt.id, { questionId: tf.id, selectedOptionIds: [tfOptions.find((o) => !o.isCorrect)!.id] });
    expect((await submitAttempt(student, attempt.id)).score).toBe(1.5);

    const second = await startAttempt(student, assessment.id);
    await answerAll(student, second.id, false);
    expect((await submitAttempt(student, second.id)).score).toBe(0);
  });

  it("treats a repeated submit as a no-op", async () => {
    const assessment = await buildAssessment();
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    await answerAll(student, attempt.id, true);
    const [a, b] = await Promise.all([submitAttempt(student, attempt.id), submitAttempt(student, attempt.id)]);
    expect(a.score).toBe(6);
    expect(b.score).toBe(6);
    const notices = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, student.id));
    expect(notices.filter((n) => n.category === "grade")).toHaveLength(1);
  });

  it("shows correct answers after release only when configured", async () => {
    const hidden = await buildAssessment({ showCorrectAnswers: false });
    const shown = await buildAssessment({ showCorrectAnswers: true });
    const student = await enrolledStudent();
    for (const [assessment, expectReveal] of [[hidden, false], [shown, true]] as const) {
      const attempt = await startAttempt(student, assessment.id);
      await answerAll(student, attempt.id, true);
      await submitAttempt(student, attempt.id);
      const result = await getAttemptResult(student, attempt.id);
      expect(result.released).toBe(true);
      if (!result.released) continue;
      const flags = result.review.flatMap((q) => q.options.map((o) => o.isCorrect));
      expect(flags.every((f) => (expectReveal ? typeof f === "boolean" : f === null))).toBe(true);
      expect(result.review.every((q) => (expectReveal ? q.explanation !== null : q.explanation === null))).toBe(true);
    }
  });
});

describe("manual grading and release", () => {
  it("holds essay attempts for the instructor, then finalises with feedback", async () => {
    const assessment = await buildAssessment({}, true);
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    await answerAll(student, attempt.id, true, "Plants convert light into chemical energy.");
    const submitted = await submitAttempt(student, attempt.id);
    expect(submitted.status).toBe("submitted");
    expect(submitted.score).toBeNull();

    const pending = await getAttemptResult(student, attempt.id);
    expect(pending.released).toBe(false);
    expect(JSON.stringify(pending)).not.toContain("score");

    // Only this course's teaching team may grade.
    await expectAppError(getAttemptForGrading(otherInstructor, attempt.id), "FORBIDDEN");
    await expectAppError(getAttemptForGrading(student, attempt.id), "FORBIDDEN");

    const grading = await getAttemptForGrading(instructor, attempt.id);
    const essay = grading.items.find((i) => i.question.type === "essay")!;
    await expectAppError(gradeAttempt(instructor, attempt.id, { grades: [] }), "VALIDATION");
    await expectAppError(
      gradeAttempt(instructor, attempt.id, { grades: [{ questionId: essay.question.id, marks: 99 }] }),
      "VALIDATION",
    );
    await expectAppError(
      gradeAttempt(otherInstructor, attempt.id, { grades: [{ questionId: essay.question.id, marks: 4 }] }),
      "FORBIDDEN",
    );

    const { attempt: graded } = await gradeAttempt(instructor, attempt.id, {
      grades: [{ questionId: essay.question.id, marks: 3, feedback: "Good, mention chlorophyll." }],
      feedback: "Solid work overall.",
    });
    expect(graded.status).toBe("graded");
    expect(graded.score).toBe(9);
    expect(graded.maxScore).toBe(10);
    expect(graded.percent).toBe(90);
    expect(graded.gradedBy).toBe(instructor.id);

    const result = await getAttemptResult(student, attempt.id);
    expect(result.released).toBe(true);
    if (result.released) {
      expect(result.attempt.feedback).toBe("Solid work overall.");
      expect(result.review.find((q) => q.type === "essay")?.feedback).toBe("Good, mention chlorophyll.");
    }
  });

  it("keeps grades hidden until the instructor releases them", async () => {
    const assessment = await buildAssessment({ resultRelease: "manual" });
    const student = await enrolledStudent();
    const attempt = await startAttempt(student, assessment.id);
    await answerAll(student, attempt.id, true);
    const done = await submitAttempt(student, attempt.id);
    expect(done.status).toBe("graded");
    expect(done.releasedAt).toBeNull();

    expect((await getAttemptResult(student, attempt.id)).released).toBe(false);
    const overview = await getAssessmentOverview(student, assessment.id);
    expect(overview.attempts[0]).toMatchObject({ percent: null, passed: null, released: false });

    await expectAppError(releaseResults(student, assessment.id), "FORBIDDEN");
    await expectAppError(releaseResults(otherInstructor, assessment.id), "FORBIDDEN");
    expect((await releaseResults(instructor, assessment.id)).released).toBe(1);

    const result = await getAttemptResult(student, attempt.id);
    expect(result.released).toBe(true);
    if (result.released) expect(result.attempt.percent).toBe(100);
  });

  it("completes the course once the required assessment is passed", async () => {
    const owner = await makeUser("instructor");
    const course = await makeCourse(owner, { lessons: 1 });
    const assessment = await createAssessment(owner, course.course.id, { ...base, title: "Final" });
    await addNewQuestion(owner, assessment.id, {
      type: "true_false",
      text: "Water is wet.",
      marks: 1,
      options: [
        { text: "True", isCorrect: true },
        { text: "False", isCorrect: false },
      ],
    });
    await setAssessmentPublished(owner, assessment.id, true);
    const student = await makeUser("student");
    await enrollInFreeCourse(student, course.course.id);
    await setLessonCompleted(student, course.lessonIds[0]!, true);
    expect(await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id))).toHaveLength(0);

    const attempt = await startAttempt(student, assessment.id);
    const q = (await getAttemptForTaking(student, attempt.id)).questions[0]!;
    const options = await db.select().from(schema.questionOptions).where(eq(schema.questionOptions.questionId, q.id));
    await saveAnswer(student, attempt.id, { questionId: q.id, selectedOptionIds: [options.find((o) => o.isCorrect)!.id] });
    await submitAttempt(student, attempt.id);

    const certs = await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id));
    expect(certs).toHaveLength(1);
    expect(certs[0]!.score).toBe(100);
  });
});

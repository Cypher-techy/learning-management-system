import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import type { Actor } from "@/server/permissions";
import {
  createAssignment,
  getAssignmentForLearner,
  getSubmissionForGrading,
  gradeSubmission,
  listSubmissions,
  saveSubmission,
  setAssignmentPublished,
  type AssignmentInput,
} from "@/server/services/assignments";
import { addFileResource } from "@/server/services/courses";
import { enrollInFreeCourse } from "@/server/services/enrollment";
import { authorizeFileAccess, uploadFile } from "@/server/services/files";
import { expectAppError, makeCourse, makeUser, PDF_BYTES, PNG_BYTES, type CourseFixture } from "../helpers";

const base: AssignmentInput = { title: "Field report", maxMarks: 50, passMarkPercent: 50, latePolicy: "accept" };

let instructor: Actor;
let otherInstructor: Actor;
let admin: Actor;
let fixture: CourseFixture;

beforeAll(async () => {
  instructor = await makeUser("instructor");
  otherInstructor = await makeUser("instructor");
  admin = await makeUser("admin");
  fixture = await makeCourse(instructor, { lessons: 1 });
});

async function publishedAssignment(overrides: Partial<AssignmentInput> = {}) {
  const assignment = await createAssignment(instructor, fixture.course.id, { ...base, ...overrides });
  await setAssignmentPublished(instructor, assignment.id, true);
  return assignment;
}

async function enrolledStudent() {
  const student = await makeUser("student");
  await enrollInFreeCourse(student, fixture.course.id);
  return student;
}

const upload = (actor: Actor, filename = "report.pdf", bytes = PDF_BYTES) =>
  uploadFile(actor, { purpose: "submission", courseId: fixture.course.id, filename, bytes });

describe("upload validation", () => {
  it("rejects disallowed types, mismatched content and oversized files", async () => {
    const student = await enrolledStudent();
    await expectAppError(upload(student, "malware.exe", Buffer.from("MZ...")), "VALIDATION");
    await expectAppError(upload(student, "page.html", Buffer.from("<script>alert(1)</script>")), "VALIDATION");
    await expectAppError(upload(student, "image.svg", Buffer.from("<svg onload=alert(1)>")), "VALIDATION");
    // An executable renamed to .pdf does not have PDF content.
    await expectAppError(upload(student, "report.pdf", Buffer.from("MZ this is not a pdf")), "VALIDATION");
    await expectAppError(upload(student, "empty.pdf", Buffer.alloc(0)), "VALIDATION");
    await expectAppError(upload(student, "big.pdf", Buffer.concat([PDF_BYTES, Buffer.alloc(26 * 1024 * 1024)])), "VALIDATION");
  });

  it("requires enrollment or course authority", async () => {
    const outsider = await makeUser("student");
    await expectAppError(upload(outsider), "FORBIDDEN");
    await expectAppError(
      uploadFile(outsider, { purpose: "lesson_resource", courseId: fixture.course.id, filename: "notes.pdf", bytes: PDF_BYTES }),
      "FORBIDDEN",
    );
    await expectAppError(
      uploadFile(otherInstructor, { purpose: "course_thumbnail", courseId: fixture.course.id, filename: "cover.png", bytes: PNG_BYTES }),
      "FORBIDDEN",
    );
    await expectAppError(
      uploadFile(instructor, { purpose: "branding", courseId: null, filename: "logo.png", bytes: PNG_BYTES }),
      "FORBIDDEN",
    );
  });

  it("stores the server-derived content type and a sanitised name", async () => {
    const student = await enrolledStudent();
    const file = await upload(student, "..\\..\\etc/passwd.pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.originalName).not.toMatch(/[\\/]/);
    expect(file.storageKey).toMatch(/^submission\/[0-9a-f-]{36}\.pdf$/);
  });
});

describe("assignment submissions", () => {
  it("saves a draft, submits and confirms", async () => {
    const assignment = await publishedAssignment();
    const student = await enrolledStudent();
    const file = await upload(student);

    await saveSubmission(student, assignment.id, { textResponse: "Work in progress", fileIds: [file.id], submit: false });
    let view = await getAssignmentForLearner(student, assignment.id);
    expect(view.submission?.status).toBe("draft");
    expect(view.attachments).toHaveLength(1);
    // Drafts are not visible to the instructor.
    expect((await listSubmissions(instructor, assignment.id)).rows).toHaveLength(0);

    await saveSubmission(student, assignment.id, { textResponse: "Final answer", fileIds: [file.id], submit: true });
    view = await getAssignmentForLearner(student, assignment.id);
    expect(view.submission).toMatchObject({ status: "submitted", isLate: false, submissionCount: 1 });
    const notices = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, student.id));
    expect(notices.some((n) => n.category === "submission")).toBe(true);
  });

  it("refuses files that belong to someone else or have the wrong type", async () => {
    const assignment = await publishedAssignment({ allowedExtensions: ["pdf"] });
    const student = await enrolledStudent();
    const classmate = await enrolledStudent();
    const theirs = await upload(classmate);
    await expectAppError(saveSubmission(student, assignment.id, { fileIds: [theirs.id], submit: true }), "VALIDATION");

    const text = await upload(student, "notes.txt", Buffer.from("plain text"));
    await expectAppError(saveSubmission(student, assignment.id, { fileIds: [text.id], submit: true }), "VALIDATION");
    await expectAppError(saveSubmission(student, assignment.id, { textResponse: "  ", fileIds: [], submit: true }), "VALIDATION");
  });

  it("applies the late-submission policy on the server", async () => {
    const past = new Date(Date.now() - 3600_000);
    const student = await enrolledStudent();

    const strict = await publishedAssignment({ dueAt: past, latePolicy: "reject" });
    await expectAppError(saveSubmission(student, strict.id, { textResponse: "Sorry it is late", submit: true }), "CONFLICT");
    expect((await getAssignmentForLearner(student, strict.id)).canEdit).toBe(false);

    const penalised = await publishedAssignment({ dueAt: past, latePolicy: "penalty", latePenaltyPercent: 20 });
    expect((await saveSubmission(student, penalised.id, { textResponse: "Late but here", submit: true })).late).toBe(true);
    const { rows } = await listSubmissions(instructor, penalised.id);
    expect(rows[0]!.submission.isLate).toBe(true);
    await gradeSubmission(instructor, rows[0]!.submission.id, { marks: 40 });
    const view = await getAssignmentForLearner(student, penalised.id);
    expect(view.submission?.marks).toBe(32); // 40 less the 20% penalty
  });

  it("honours the resubmission setting", async () => {
    const student = await enrolledStudent();
    const once = await publishedAssignment({ allowResubmission: false });
    await saveSubmission(student, once.id, { textResponse: "First and only", submit: true });
    await expectAppError(saveSubmission(student, once.id, { textResponse: "Second try", submit: true }), "CONFLICT");

    const many = await publishedAssignment({ allowResubmission: true });
    await saveSubmission(student, many.id, { textResponse: "First", submit: true });
    await saveSubmission(student, many.id, { textResponse: "Improved", submit: true });
    const view = await getAssignmentForLearner(student, many.id);
    expect(view.submission).toMatchObject({ submissionCount: 2, textResponse: "Improved" });
  });

  it("supports grading with feedback and hides it until released", async () => {
    const assignment = await publishedAssignment();
    const student = await enrolledStudent();
    await saveSubmission(student, assignment.id, { textResponse: "My report", submit: true });
    const { rows } = await listSubmissions(instructor, assignment.id);
    const submissionId = rows[0]!.submission.id;

    await expectAppError(gradeSubmission(student, submissionId, { marks: 50 }), "FORBIDDEN");
    await expectAppError(gradeSubmission(otherInstructor, submissionId, { marks: 50 }), "FORBIDDEN");
    await expectAppError(getSubmissionForGrading(otherInstructor, submissionId), "FORBIDDEN");
    await expectAppError(gradeSubmission(instructor, submissionId, { marks: 51 }), "VALIDATION");

    await gradeSubmission(instructor, submissionId, { marks: 42, feedback: "Clear and thorough.", release: false });
    let view = await getAssignmentForLearner(student, assignment.id);
    expect(view.submission).toMatchObject({ status: "submitted", marks: null, feedback: null });

    await gradeSubmission(instructor, submissionId, { marks: 42, feedback: "Clear and thorough.", release: true });
    view = await getAssignmentForLearner(student, assignment.id);
    expect(view.submission).toMatchObject({ status: "graded", marks: 42, feedback: "Clear and thorough." });
    await expectAppError(saveSubmission(student, assignment.id, { textResponse: "Changed after grading", submit: true }), "CONFLICT");
  });

  it("keeps one learner's submission invisible to another", async () => {
    const assignment = await publishedAssignment();
    const student = await enrolledStudent();
    const classmate = await enrolledStudent();
    await saveSubmission(student, assignment.id, { textResponse: "Private work", submit: true });
    const view = await getAssignmentForLearner(classmate, assignment.id);
    expect(view.submission).toBeNull();
    expect(JSON.stringify(view)).not.toContain("Private work");
    const outsider = await makeUser("student");
    await expectAppError(getAssignmentForLearner(outsider, assignment.id), "FORBIDDEN");
  });
});

describe("file protection", () => {
  it("protects assignment files from everyone but the author and the course's graders", async () => {
    const student = await enrolledStudent();
    const classmate = await enrolledStudent();
    const file = await upload(student);

    await expect(authorizeFileAccess(student, file.id)).resolves.toBeTruthy();
    await expect(authorizeFileAccess(instructor, file.id)).resolves.toBeTruthy();
    await expect(authorizeFileAccess(admin, file.id)).resolves.toBeTruthy();

    await expectAppError(authorizeFileAccess(null, file.id), "NOT_FOUND");
    await expectAppError(authorizeFileAccess(classmate, file.id), "NOT_FOUND");
    await expectAppError(authorizeFileAccess(otherInstructor, file.id), "NOT_FOUND");
    await expectAppError(authorizeFileAccess(student, "not-a-uuid"), "NOT_FOUND");
  });

  it("serves lesson material only to enrolled learners, except preview lessons", async () => {
    const resource = await uploadFile(instructor, {
      purpose: "lesson_resource",
      courseId: fixture.course.id,
      filename: "handout.pdf",
      bytes: PDF_BYTES,
    });
    const unattached = await uploadFile(instructor, {
      purpose: "lesson_resource",
      courseId: fixture.course.id,
      filename: "draft.pdf",
      bytes: PDF_BYTES,
    });
    await addFileResource(instructor, fixture.lessonIds[0]!, resource.id, "Handout");
    const student = await enrolledStudent();
    const outsider = await makeUser("student");

    await expect(authorizeFileAccess(student, resource.id)).resolves.toBeTruthy();
    await expectAppError(authorizeFileAccess(outsider, resource.id), "NOT_FOUND");
    await expectAppError(authorizeFileAccess(null, resource.id), "UNAUTHENTICATED");
    // A file not attached to any lesson is staff-only.
    await expectAppError(authorizeFileAccess(student, unattached.id), "NOT_FOUND");

    await db.update(schema.lessons).set({ isPreview: true }).where(eq(schema.lessons.id, fixture.lessonIds[0]!));
    await expect(authorizeFileAccess(null, resource.id)).resolves.toBeTruthy();
    await db.update(schema.lessons).set({ isPreview: false }).where(eq(schema.lessons.id, fixture.lessonIds[0]!));
  });

  it("forces non-renderable types to download", async () => {
    const student = await enrolledStudent();
    const text = await upload(student, "notes.txt", Buffer.from("hello"));
    const pdf = await upload(student);
    expect((await authorizeFileAccess(student, text.id)).inline).toBe(false);
    expect((await authorizeFileAccess(student, pdf.id)).inline).toBe(true);
  });
});

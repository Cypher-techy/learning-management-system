import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { CERTIFICATE_NUMBER, revokeCertificate, reinstateCertificate, verifyCertificate, getCertificateForDownload, renderCertificatePdf, issueCertificate } from "@/server/services/certificates";
import { enrollInFreeCourse, grantEnrollment, setEnrollmentStatus } from "@/server/services/enrollment";
import { computeProgress, recordLessonVisit, saveNote, setLessonCompleted, toggleBookmark } from "@/server/services/progress";
import { expectAppError, makeCourse, makeUser } from "../helpers";

async function enrollmentOf(userId: string, courseId: string) {
  const [row] = await db
    .select()
    .from(schema.enrollments)
    .where(and(eq(schema.enrollments.userId, userId), eq(schema.enrollments.courseId, courseId)));
  return row!;
}

describe("enrollment", () => {
  it("enrolls a learner in an eligible free course exactly once", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course } = await makeCourse(instructor);

    expect((await enrollInFreeCourse(student, course.id)).created).toBe(true);
    expect((await enrollInFreeCourse(student, course.id)).created).toBe(false);
    const rows = await db.select().from(schema.enrollments).where(eq(schema.enrollments.userId, student.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("active");

    const notes = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, student.id));
    expect(notes.some((n) => n.category === "enrollment")).toBe(true);
  });

  it("refuses free enrollment in a paid course", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course } = await makeCourse(instructor, { priceCents: 150000 });
    await expectAppError(enrollInFreeCourse(student, course.id), "FORBIDDEN");
    expect(await db.select().from(schema.enrollments).where(eq(schema.enrollments.courseId, course.id))).toHaveLength(0);
  });

  it("enforces closed enrollment and seat limits", async () => {
    const instructor = await makeUser("instructor");
    const a = await makeUser("student");
    const b = await makeUser("student");
    const { course } = await makeCourse(instructor);
    await db.update(schema.courses).set({ enrollmentLimit: 1 }).where(eq(schema.courses.id, course.id));
    await enrollInFreeCourse(a, course.id);
    await expectAppError(enrollInFreeCourse(b, course.id), "CONFLICT");

    await db.update(schema.courses).set({ enrollmentLimit: null, enrollmentOpen: false }).where(eq(schema.courses.id, course.id));
    await expectAppError(enrollInFreeCourse(b, course.id), "CONFLICT");
  });

  it("lets only authorized staff grant or suspend enrollments", async () => {
    const instructor = await makeUser("instructor");
    const admin = await makeUser("admin");
    const student = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor, { priceCents: 5000 });

    await expectAppError(grantEnrollment(instructor, student.email, course.id), "FORBIDDEN");
    const granted = await grantEnrollment(admin, student.email, course.id);
    expect(granted.enrollment.source).toBe("admin_grant");

    await setEnrollmentStatus(admin, granted.enrollment.id, "suspended");
    await expectAppError(setLessonCompleted(student, lessonIds[0]!, true), "FORBIDDEN");
  });
});

describe("progress tracking", () => {
  it("does not count opening a lesson as completing it", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor, { lessons: 4 });
    await enrollInFreeCourse(student, course.id);

    await recordLessonVisit(student, lessonIds[0]!);
    await recordLessonVisit(student, lessonIds[1]!);
    expect((await computeProgress(db, student.id, course.id)).percent).toBe(0);
    const enrollment = await enrollmentOf(student.id, course.id);
    expect(enrollment.progressPercent).toBe(0);
    expect(enrollment.lastLessonId).toBe(lessonIds[1]);
  });

  it("persists completion and restores it for a later session", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor, { lessons: 4 });
    await enrollInFreeCourse(student, course.id);

    expect((await setLessonCompleted(student, lessonIds[0]!, true)).percent).toBe(25);
    expect((await setLessonCompleted(student, lessonIds[1]!, true)).percent).toBe(50);

    // A "new session" has nothing but the database to read from.
    const restored = await computeProgress(db, student.id, course.id);
    expect(restored.completed).toBe(2);
    expect(restored.percent).toBe(50);
    expect(restored.completedIds.has(lessonIds[0]!)).toBe(true);
    expect((await enrollmentOf(student.id, course.id)).progressPercent).toBe(50);

    expect((await setLessonCompleted(student, lessonIds[1]!, false)).percent).toBe(25);
  });

  it("keeps bookmarks and notes private to their owner", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const outsider = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor);
    await enrollInFreeCourse(student, course.id);

    expect((await toggleBookmark(student, lessonIds[0]!)).bookmarked).toBe(true);
    await saveNote(student, lessonIds[0]!, "Remember the key formula.");
    await expectAppError(toggleBookmark(outsider, lessonIds[0]!), "FORBIDDEN");
    await expectAppError(saveNote(outsider, lessonIds[0]!, "x"), "FORBIDDEN");

    const notes = await db.select().from(schema.lessonNotes).where(eq(schema.lessonNotes.lessonId, lessonIds[0]!));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.userId).toBe(student.id);
  });
});

describe("certificates", () => {
  it("issues a certificate only when the completion requirements are met", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor, { lessons: 2 });
    await enrollInFreeCourse(student, course.id);

    await setLessonCompleted(student, lessonIds[0]!, true);
    expect(await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id))).toHaveLength(0);

    const result = await setLessonCompleted(student, lessonIds[1]!, true);
    expect(result.courseCompleted).toBe(true);
    const certs = await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id));
    expect(certs).toHaveLength(1);
    expect(certs[0]!.number).toMatch(CERTIFICATE_NUMBER);
    expect(certs[0]!.learnerName).toBe(student.name);
    expect((await enrollmentOf(student.id, course.id)).status).toBe("completed");

    // Completing again must not create a second certificate.
    await setLessonCompleted(student, lessonIds[1]!, true);
    expect(await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id))).toHaveLength(1);
  });

  it("withholds the certificate while a required assessment is outstanding", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor, { lessons: 1 });
    await db.insert(schema.assessments).values({ courseId: course.id, title: "Final exam", isPublished: true, requiredForCompletion: true });
    await enrollInFreeCourse(student, course.id);

    const result = await setLessonCompleted(student, lessonIds[0]!, true);
    expect(result.courseCompleted).toBe(false);
    expect(result.percent).toBe(100);
    expect(await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id))).toHaveLength(0);
    expect((await enrollmentOf(student.id, course.id)).status).toBe("active");
  });

  it("cannot be issued for an enrollment that is not completed", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course } = await makeCourse(instructor);
    await enrollInFreeCourse(student, course.id);
    await expectAppError(issueCertificate(db, await enrollmentOf(student.id, course.id), null), "CONFLICT");
  });

  it("verifies, revokes and reinstates with the correct public status", async () => {
    const instructor = await makeUser("instructor");
    const admin = await makeUser("admin");
    const student = await makeUser("student");
    const stranger = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor, { lessons: 1 });
    await enrollInFreeCourse(student, course.id);
    await setLessonCompleted(student, lessonIds[0]!, true);
    const [cert] = await db.select().from(schema.certificates).where(eq(schema.certificates.userId, student.id));

    const valid = await verifyCertificate(cert!.number.toLowerCase());
    expect(valid).toMatchObject({ found: true, status: "valid", learnerName: student.name, courseTitle: course.title });
    // Only the minimum needed to establish authenticity is disclosed.
    expect(Object.keys(valid)).not.toContain("userId");
    expect(JSON.stringify(valid)).not.toContain(student.email);

    expect(await verifyCertificate("CERT-2026-AAAAA-AAAAA")).toEqual({ found: false });
    expect(await verifyCertificate("'; drop table certificates; --")).toEqual({ found: false });

    await expectAppError(revokeCertificate(student, cert!.id, "I changed my mind"), "FORBIDDEN");
    await expectAppError(getCertificateForDownload(stranger, cert!.id), "NOT_FOUND");

    const pdf = await renderCertificatePdf(await getCertificateForDownload(student, cert!.id));
    expect(Buffer.from(pdf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");

    await revokeCertificate(admin, cert!.id, "Issued in error");
    expect(await verifyCertificate(cert!.number)).toMatchObject({ found: true, status: "revoked" });
    await expectAppError(getCertificateForDownload(student, cert!.id), "FORBIDDEN");

    await reinstateCertificate(admin, cert!.id);
    expect(await verifyCertificate(cert!.number)).toMatchObject({ found: true, status: "valid" });
  });
});

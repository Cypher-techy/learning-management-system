import { getDB, persist, uid, now, courseLessons, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student");
    const db = getDB();
    const course = db.courses.find(c => c.id === id);
    if (!course) throw new ApiError(404, "Course not found.");
    const enr = db.enrollments.find(e => e.courseId === id && e.studentId === user.id);
    const total = courseLessons(course).length;
    const progress = enr && total ? (enr.completedLessons.length / total) * 100 : 0;
    // Certificates require real completion — never issued for merely opening a course.
    if (progress < db.settings.certificateMinProgress) throw new ApiError(400, `Complete ${db.settings.certificateMinProgress}% of lessons to earn a certificate (currently ${Math.round(progress)}%).`);
    const courseQuizzes = db.quizzes.filter(q => q.courseId === id);
    for (const q of courseQuizzes) {
      const best = db.quizAttempts.filter(a => a.quizId === q.id && a.studentId === user.id).sort((a, b) => b.score / b.total - a.score / a.total)[0];
      if (!best || (best.score / Math.max(best.total, 1)) * 100 < db.settings.certificateMinQuiz)
        throw new ApiError(400, `Pass "${q.title}" with at least ${db.settings.certificateMinQuiz}% to earn this certificate.`);
    }
    let cert = db.certificates.find(c => c.courseId === id && c.studentId === user.id && !c.revoked);
    if (!cert) {
      cert = { id: uid("c_"), code: `EDV-${new Date().getFullYear()}-${uid("").slice(0, 6).toUpperCase()}`, studentId: user.id, courseId: id, issuedAt: now() };
      db.certificates.push(cert);
      notify(user.id, "Certificate issued", `Your certificate for "${course.title}" is ready.`, "/dashboard/student/certificates");
    }
    persist();
    return Response.json({ ok: true, certificate: cert });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, now } from "@/lib/db";
import { currentUser, jsonError, ApiError } from "@/lib/auth";
import { serializeCourse } from "@/lib/serialize";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDB();
  const user = await currentUser();
  const course = db.courses.find(c => c.id === id || c.slug === id);
  if (!course) return Response.json({ error: "Course not found" }, { status: 404 });
  const privileged = user && (user.role === "owner" || user.role === "administrator" || course.tutorId === user.id);
  if (course.status !== "published" && !privileged) return Response.json({ error: "Course not found" }, { status: 404 });
  const enrollment = user ? db.enrollments.find(e => e.courseId === course.id && e.studentId === user.id) : null;
  return Response.json({
    course: serializeCourse(db, course, user), enrollment,
    quizzes: db.quizzes.filter(q => q.courseId === course.id).map(q => ({ ...q, questions: q.questions.map(({ answer, ...rest }) => ({ ...rest, answer: undefined })) })),
    assignments: db.assignments.filter(a => a.courseId === course.id),
    reviews: db.reviews.filter(r => r.courseId === course.id).map(r => ({ ...r, studentName: db.users.find(u => u.id === r.studentId)?.fullName || "Student" })),
    discussions: db.discussions.filter(d => d.courseId === course.id),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await currentUser();
    if (!user) throw new ApiError(401, "Please sign in.");
    const db = getDB();
    const course = db.courses.find(c => c.id === id);
    if (!course) throw new ApiError(404, "Course not found.");
    const b = await req.json();
    // Tutor lifecycle transitions (own courses only)
    if (user.role === "tutor" && course.tutorId === user.id) {
      if (user.status !== "verified") throw new ApiError(403, "Unverified tutors cannot publish or submit courses.");
      if (b.action === "submit" && ["draft", "rejected", "unpublished"].includes(course.status)) course.status = "in_review";
      else if (b.action === "unpublish" && course.status === "published") course.status = "unpublished";
      else if (b.action === "publish" && course.status === "approved") { course.status = "published"; course.publishedAt = now(); }
      else if (b.patch) Object.assign(course, { title: b.patch.title ?? course.title, subtitle: b.patch.subtitle ?? course.subtitle, description: b.patch.description ?? course.description, access: b.patch.access ?? course.access, level: b.patch.level ?? course.level, category: b.patch.category ?? course.category });
      else throw new ApiError(400, "That transition is not allowed from the current course state.");
      persist();
      return Response.json({ ok: true, course: serializeCourse(db, course, user) });
    }
    // Admin / owner moderation
    if ((user.role === "administrator" && user.status === "verified") || user.role === "owner") {
      if (b.action === "approve") { course.status = "published"; course.publishedAt = now(); course.moderationNote = b.note || "Approved"; }
      else if (b.action === "reject") { course.status = "rejected"; course.moderationNote = b.note || "Changes requested"; }
      else if (b.action === "unpublish") course.status = "unpublished";
      else if (b.action === "feature") course.featured = !course.featured;
      else if (b.access) course.access = b.access;
      else throw new ApiError(400, "Unknown moderation action.");
      db.auditLogs.unshift({ id: "al_" + Date.now(), actorId: user.id, action: `course.${b.action || "access"}`, target: course.id, reason: b.note, createdAt: now() });
      db.notifications.unshift({ id: "n_" + Date.now(), userId: course.tutorId, title: `Course update: ${course.title}`, body: course.moderationNote || `Your course status is now ${course.status}.`, createdAt: now(), read: false, href: "/dashboard/tutor/courses" });
      persist();
      return Response.json({ ok: true, course: serializeCourse(db, course, user) });
    }
    throw new ApiError(403, "You cannot modify this course.");
  } catch (e) { return jsonError(e); }
}

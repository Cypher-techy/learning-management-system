import { getDB, persist, uid, now, canAccessCourse } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student");
    const db = getDB();
    const course = db.courses.find(c => c.id === id && c.status === "published");
    if (!course) throw new ApiError(404, "Course not found.");
    const { save } = await req.json().catch(() => ({}));
    let enr = db.enrollments.find(e => e.courseId === id && e.studentId === user.id);
    if (save !== undefined && enr) { enr.saved = !!save; persist(); return Response.json({ ok: true, enrollment: enr }); }
    if (!canAccessCourse(db, user, course)) throw new ApiError(403, "This is a Premium course. Subscribe to EDVORA Premium to enrol.");
    if (!enr) {
      enr = { id: uid("e_"), studentId: user.id, courseId: id, enrolledAt: now(), completedLessons: [], saved: false, activeMin: 0 };
      db.enrollments.push(enr);
      db.notifications.unshift({ id: uid("n_"), userId: course.instructorId, title: "New enrolment", body: `${user.fullName} enrolled in "${course.title}".`, createdAt: now(), read: false });
      db.notifications.unshift({ id: uid("n_"), userId: user.id, title: "Enrolment confirmed", body: `You are enrolled in "${course.title}". Happy learning!`, createdAt: now(), read: false });
    }
    persist();
    return Response.json({ ok: true, enrollment: enr });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, now, courseLessons, canAccessCourse } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student");
    const db = await getDB();
    const course = db.courses.find(c => c.id === id);
    if (!course) throw new ApiError(404, "Course not found.");
    if (!canAccessCourse(db, user, course)) throw new ApiError(403, "Premium access required.");
    const enr = db.enrollments.find(e => e.courseId === id && e.studentId === user.id);
    if (!enr) throw new ApiError(400, "Enrol in this course first.");
    const { lessonId, complete, activeMin } = await req.json();
    const valid = courseLessons(course).some(l => l.id === lessonId);
    if (!valid) throw new ApiError(400, "Unknown lesson.");
    enr.lastLessonId = lessonId;
    if (complete && !enr.completedLessons.includes(lessonId)) enr.completedLessons.push(lessonId);
    if (typeof activeMin === "number" && activeMin > 0 && activeMin <= 30) enr.activeMin += activeMin;
    const total = courseLessons(course).length;
    if (total > 0 && enr.completedLessons.length >= total && !enr.completedAt) enr.completedAt = now();
    await persist();
    return Response.json({ ok: true, enrollment: enr, progress: total ? Math.round((enr.completedLessons.length / total) * 100) : 0 });
  } catch (e) { return jsonError(e); }
}

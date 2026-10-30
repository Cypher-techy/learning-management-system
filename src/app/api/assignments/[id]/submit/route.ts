import { getDB, persist, uid, now, canAccessCourse, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student");
    const db = await getDB();
    const assignment = db.assignments.find(a => a.id === id);
    if (!assignment) throw new ApiError(404, "Assignment not found.");
    const course = db.courses.find(c => c.id === assignment.courseId)!;
    if (!canAccessCourse(db, user, course)) throw new ApiError(403, "Premium access required.");
    const { content, fileName } = await req.json();
    if (!content?.trim() && !fileName) throw new ApiError(400, "Write your submission or attach a file name/reference.");
    let sub = db.submissions.find(s => s.assignmentId === id && s.studentId === user.id);
    if (sub) { sub.content = content || sub.content; sub.fileName = fileName; sub.submittedAt = now(); sub.status = "submitted"; sub.grade = undefined; sub.feedback = undefined; }
    else { sub = { id: uid("s_"), assignmentId: id, courseId: assignment.courseId, studentId: user.id, content: content || "", fileName, submittedAt: now(), status: "submitted" }; db.submissions.push(sub); }
    notify(course.tutorId, "New assignment submission", `${user.fullName} submitted "${assignment.title}".`, "/dashboard/tutor/students");
    await persist();
    return Response.json({ ok: true, submission: sub });
  } catch (e) { return jsonError(e); }
}

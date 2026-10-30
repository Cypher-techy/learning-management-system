import { getDB, persist, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("teacher", "administrator", "owner");
    if (user.role === "teacher") requireVerified(user);
    const db = getDB();
    const sub = db.submissions.find(s => s.id === id);
    if (!sub) throw new ApiError(404, "Submission not found.");
    const course = db.courses.find(c => c.id === sub.courseId)!;
    if (user.role === "teacher" && course.instructorId !== user.id) throw new ApiError(403, "You can only grade submissions in your own courses.");
    const { grade, feedback } = await req.json();
    const assignment = db.assignments.find(a => a.id === sub.assignmentId);
    if (typeof grade !== "number" || grade < 0 || grade > (assignment?.maxScore || 100)) throw new ApiError(400, "Enter a valid grade.");
    sub.grade = grade; sub.feedback = feedback || ""; sub.status = "graded";
    notify(sub.studentId, "Assignment graded", `"${assignment?.title}": ${grade}/${assignment?.maxScore || 100}.`, "/dashboard/student/assignments");
    persist();
    return Response.json({ ok: true, submission: sub });
  } catch (e) { return jsonError(e); }
}

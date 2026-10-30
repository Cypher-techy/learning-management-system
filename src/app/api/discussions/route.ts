import { getDB, persist, uid, now } from "@/lib/db";
import { jsonError, ApiError, requireRole, currentUser } from "@/lib/auth";

export async function GET(req: Request) {
  const db = getDB();
  const courseId = new URL(req.url).searchParams.get("courseId");
  const list = db.discussions.filter(d => !courseId || d.courseId === courseId).map(d => ({
    ...d, authorName: db.users.find(u => u.id === d.authorId)?.fullName || "Member",
    authorRole: db.users.find(u => u.id === d.authorId)?.role, courseTitle: db.courses.find(c => c.id === d.courseId)?.title,
    replies: db.replies.filter(r => r.discussionId === d.id).map(r => ({ ...r, authorName: db.users.find(u => u.id === r.authorId)?.fullName || "Member", authorRole: db.users.find(u => u.id === r.authorId)?.role })),
  }));
  return Response.json({ discussions: list });
}
export async function POST(req: Request) {
  try {
    const user = await requireRole("student", "tutor", "administrator", "owner");
    const db = getDB();
    const { courseId, title, body } = await req.json();
    if (!courseId || !title?.trim() || !body?.trim()) throw new ApiError(400, "Course, title and message are required.");
    if (user.role === "student" && !db.enrollments.some(e => e.courseId === courseId && e.studentId === user.id))
      throw new ApiError(403, "Enrol in this course to join its discussion.");
    const d = { id: uid("d_"), courseId, authorId: user.id, title: title.trim(), body: body.trim(), createdAt: now() };
    db.discussions.unshift(d); persist();
    return Response.json({ ok: true, discussion: d });
  } catch (e) { return jsonError(e); }
}
export async function DELETE(req: Request) {
  try {
    const user = await requireRole("administrator", "owner", "tutor");
    const id = new URL(req.url).searchParams.get("id");
    void (await currentUser());
    const db = getDB();
    const d = db.discussions.find(x => x.id === id);
    if (!d) throw new ApiError(404, "Discussion not found.");
    if (user.role === "tutor") {
      const c = db.courses.find(x => x.id === d.courseId);
      if (!c || c.tutorId !== user.id) throw new ApiError(403, "You can only moderate discussions in your own courses.");
    }
    db.discussions = db.discussions.filter(x => x.id !== id);
    db.replies = db.replies.filter(x => x.discussionId !== id);
    persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, uid, now, notify, audit } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const actor = await requireRole("administrator", "owner", "teacher");
    if (actor.role !== "owner") requireVerified(actor);
    const { title, body, audience, courseId } = await req.json();
    if (!title?.trim() || !body?.trim()) throw new ApiError(400, "Title and message are required.");
    const db = getDB();
    if (actor.role === "teacher") {
      const course = db.courses.find(c => c.id === courseId && c.instructorId === actor.id);
      if (!course) throw new ApiError(403, "Teachers can only announce to their own courses.");
    }
    db.announcements.unshift({ id: uid("an_"), authorId: actor.id, audience: audience || "all-students", title, body, createdAt: now() });
    let targets = db.users.filter(u => u.status === "verified");
    if (audience === "all-students") targets = targets.filter(u => u.role === "student");
    else if (audience === "teachers") targets = targets.filter(u => u.role === "teacher");
    else if (audience === "course" && courseId) targets = targets.filter(u => db.enrollments.some(e => e.courseId === courseId && e.studentId === u.id));
    targets.forEach(u => notify(u.id, title, body));
    audit(actor.id, "announcement.published", audience || "all-students", title);
    persist();
    return Response.json({ ok: true, deliveredTo: targets.length });
  } catch (e) { return jsonError(e); }
}

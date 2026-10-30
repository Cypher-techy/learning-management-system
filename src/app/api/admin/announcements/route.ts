import { getDB, persist, uid, now, notify, audit } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const actor = await requireRole("administrator", "owner", "tutor");
    if (actor.role !== "owner") requireVerified(actor);
    const { title, body, audience, courseId } = await req.json();
    if (!title?.trim() || !body?.trim()) throw new ApiError(400, "Title and message are required.");
    const db = await getDB();
    if (actor.role === "tutor") {
      const course = db.courses.find(c => c.id === courseId && c.tutorId === actor.id);
      if (!course) throw new ApiError(403, "Tutors can only announce to their own courses.");
    }
    db.announcements.unshift({ id: uid("an_"), authorId: actor.id, audience: audience || "all-students", title, body, createdAt: now() });
    let targets = db.users.filter(u => u.status === "verified");
    if (audience === "all-students") targets = targets.filter(u => u.role === "student");
    else if (audience === "tutors") targets = targets.filter(u => u.role === "tutor");
    else if (audience === "course" && courseId) targets = targets.filter(u => db.enrollments.some(e => e.courseId === courseId && e.studentId === u.id));
    targets.forEach(u => notify(u.id, title, body));
    audit(actor.id, "announcement.published", audience || "all-students", title);
    await persist();
    return Response.json({ ok: true, deliveredTo: targets.length });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, uid, now, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student", "teacher", "administrator", "owner");
    const db = getDB();
    const d = db.discussions.find(x => x.id === id);
    if (!d) throw new ApiError(404, "Discussion not found.");
    const { body } = await req.json();
    if (!body?.trim()) throw new ApiError(400, "Write a reply first.");
    const r = { id: uid("rp_"), discussionId: id, authorId: user.id, body: body.trim(), createdAt: now() };
    db.replies.push(r);
    if (d.authorId !== user.id) notify(d.authorId, "New reply to your discussion", `${user.fullName} replied to "${d.title}".`, "/dashboard/student/community");
    persist();
    return Response.json({ ok: true, reply: r });
  } catch (e) { return jsonError(e); }
}

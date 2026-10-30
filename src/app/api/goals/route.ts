import { getDB, persist, uid, now } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const u = await requireRole("student");
    const db = getDB();
    const { title, targetHoursPerWeek } = await req.json();
    if (!title?.trim()) throw new ApiError(400, "Name your learning goal.");
    const g = { id: uid("g_"), studentId: u.id, title: title.trim(), targetHoursPerWeek: Number(targetHoursPerWeek) || 3, createdAt: now(), done: false };
    db.goals.unshift(g); persist();
    return Response.json({ ok: true, goal: g });
  } catch (e) { return jsonError(e); }
}
export async function PATCH(req: Request) {
  try {
    const u = await requireRole("student");
    const db = getDB();
    const { id, done } = await req.json();
    const g = db.goals.find(x => x.id === id && x.studentId === u.id);
    if (!g) throw new ApiError(404, "Goal not found.");
    g.done = !!done; persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";
export async function GET() {
  try { const u = await requireRole("student", "tutor", "administrator", "owner"); return Response.json({ notifications: (await getDB()).notifications.filter(n => n.userId === u.id).slice(0, 40) }); }
  catch (e) { return jsonError(e); }
}
export async function PATCH(req: Request) {
  try {
    const u = await requireRole("student", "tutor", "administrator", "owner");
    const db = await getDB();
    const { id } = await req.json().catch(() => ({}));
    db.notifications.forEach(n => { if (n.userId === u.id && (!id || n.id === id)) n.read = true; });
    await persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

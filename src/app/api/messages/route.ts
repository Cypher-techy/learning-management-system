import { getDB, persist, uid, now, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function GET() {
  try {
    const user = await requireRole("student", "teacher", "administrator", "owner");
    const db = getDB();
    const mine = db.messages.filter(m => m.fromId === user.id || m.toId === user.id)
      .map(m => ({ ...m, fromName: db.users.find(u => u.id === m.fromId)?.fullName, toName: db.users.find(u => u.id === m.toId)?.fullName }));
    const partners = db.users.filter(u => u.id !== user.id && u.role !== "owner" &&
      (user.role !== "student" || u.role === "teacher") &&
      (user.role !== "teacher" || u.role === "student" || u.role === "teacher"))
      .map(u => ({ id: u.id, fullName: u.fullName, role: u.role, title: u.title }));
    return Response.json({ messages: mine, partners });
  } catch (e) { return jsonError(e); }
}
export async function POST(req: Request) {
  try {
    const user = await requireRole("student", "teacher", "administrator", "owner");
    const db = getDB();
    const { toId, body } = await req.json();
    if (!toId || !body?.trim()) throw new ApiError(400, "Choose a recipient and write a message.");
    const to = db.users.find(u => u.id === toId);
    if (!to || to.role === "owner") throw new ApiError(404, "Recipient not found.");
    if (user.role === "student" && to.role !== "teacher") throw new ApiError(403, "Students can message instructors directly. Use course discussions for peer chat.");
    const m = { id: uid("m_"), fromId: user.id, toId, body: body.trim(), createdAt: now(), read: false };
    db.messages.push(m);
    notify(toId, "New message", `${user.fullName}: ${body.slice(0, 90)}`, user.role === "teacher" ? "/dashboard/student/messages" : "/dashboard/teacher/messages");
    persist();
    return Response.json({ ok: true, message: m });
  } catch (e) { return jsonError(e); }
}
export async function PATCH() {
  try {
    const user = await requireRole("student", "teacher", "administrator", "owner");
    const db = getDB();
    db.messages.forEach(m => { if (m.toId === user.id) m.read = true; });
    persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

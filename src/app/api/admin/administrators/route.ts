import { getDB, persist, uid, now, audit, hashPassword } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
/** Owner-only: create/invite administrators. They remain pending until approved. */
export async function POST(req: Request) {
  try {
    const actor = await requireRole("owner");
    const db = await getDB();
    const { fullName, email, phone, temporaryPassword } = await req.json();
    if (!fullName || !email) throw new ApiError(400, "Name and email are required.");
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new ApiError(409, "An account with this email already exists.");
    const user = {
      id: uid("u_"), fullName, email: email.toLowerCase(), phone: phone || "",
      passwordHash: hashPassword(temporaryPassword || uid("Tmp!")), role: "administrator" as const,
      status: "pending" as const, createdAt: now(), avatarColor: "#4f46e5", plan: "free" as const,
      contactVerified: false, notificationPrefs: { email: true, inApp: true },
    };
    db.users.push(user);
    audit(actor.id, "administrator.invited", user.id);
    await persist();
    return Response.json({ ok: true, administrator: { id: user.id, fullName: user.fullName, email: user.email, status: user.status } });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, hashPassword, verifyPassword, publicUser } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function PATCH(req: Request) {
  try {
    const user = await requireRole("student", "teacher", "administrator", "owner");
    const db = getDB();
    const me = db.users.find(u => u.id === user.id)!;
    const b = await req.json();
    if (b.newPassword) {
      if (!verifyPassword(b.currentPassword || "", me.passwordHash)) throw new ApiError(400, "Current password is incorrect.");
      if (b.newPassword.length < 8) throw new ApiError(400, "New password must be at least 8 characters.");
      me.passwordHash = hashPassword(b.newPassword);
    }
    for (const k of ["fullName", "phone", "bio", "title", "payoutMethod", "payoutAccount"] as const)
      if (b[k] !== undefined) (me as any)[k] = b[k];
    if (b.notificationPrefs) me.notificationPrefs = { ...me.notificationPrefs, ...b.notificationPrefs };
    persist();
    return Response.json({ ok: true, user: publicUser(me) });
  } catch (e) { return jsonError(e); }
}

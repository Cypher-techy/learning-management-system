import { getDB, persist, verifyPassword, now } from "@/lib/db";
import { jsonError, ApiError, setSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password, expectedRole } = await req.json();
    const db = getDB();
    const user = db.users.find(u => u.email.toLowerCase() === String(email || "").toLowerCase());
    if (!user || !verifyPassword(String(password || ""), user.passwordHash))
      throw new ApiError(401, "Invalid email or password.");
    if (user.status === "suspended") throw new ApiError(403, "This account has been suspended. Contact support.");
    if (user.status === "disabled" || user.status === "rejected") throw new ApiError(403, "This account is not active. Contact support.");
    // The database role is authoritative — a portal selection can never upgrade access.
    if (expectedRole && user.role !== expectedRole)
      throw new ApiError(403, `This is a ${user.role} account. Please use the ${user.role} sign-in.`);
    user.lastLoginAt = now(); persist();
    await setSession(user);
    return Response.json({ ok: true, role: user.role, status: user.status });
  } catch (e) { return jsonError(e); }
}

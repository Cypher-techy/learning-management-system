import { getDB, persist, uid, now, hashPassword } from "@/lib/db";
import { jsonError, ApiError, setSession } from "@/lib/auth";
import crypto from "crypto";

/** One-time platform bootstrap. Server-only env: OWNER_EMAIL + OWNER_SETUP_SECRET.
 *  The setup secret is invalidated after first successful use and the process
 *  can never run twice, so redeploys cannot reset or duplicate the account. */
export async function POST(req: Request) {
  try {
    const { email, setupSecret, fullName, password } = await req.json();
    const db = getDB();
    if (db.meta.ownerInitialised || db.meta.setupSecretUsed) throw new ApiError(403, "Initialisation has already been completed.");
    const expectedEmail = process.env.OWNER_EMAIL;
    const expectedSecret = process.env.OWNER_SETUP_SECRET;
    if (!expectedEmail || !expectedSecret) throw new ApiError(503, "Bootstrap is not configured on this deployment.");
    const okEmail = String(email || "").toLowerCase() === expectedEmail.toLowerCase();
    const a = Buffer.from(String(setupSecret || "")), b = Buffer.from(expectedSecret);
    const okSecret = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!okEmail || !okSecret) throw new ApiError(403, "Bootstrap verification failed.");
    if (!password || password.length < 12) throw new ApiError(400, "Choose a password of at least 12 characters.");
    const user = {
      id: uid("u_"), fullName: fullName || "Platform Owner", email: expectedEmail.toLowerCase(),
      phone: "", passwordHash: hashPassword(password), role: "owner" as const,
      status: "verified" as const, createdAt: now(), avatarColor: "#4f46e5",
      plan: "premium" as const, contactVerified: true, notificationPrefs: { email: true, inApp: true },
    };
    db.users.push(user);
    db.meta.ownerInitialised = true; db.meta.setupSecretUsed = true;
    db.auditLogs.unshift({ id: uid("al_"), actorId: user.id, action: "platform.bootstrap", target: user.id, createdAt: now() });
    persist();
    await setSession(user as any);
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}
export async function GET() {
  const db = getDB();
  return Response.json({ initialised: db.meta.ownerInitialised, configured: !!(process.env.OWNER_EMAIL && process.env.OWNER_SETUP_SECRET) });
}

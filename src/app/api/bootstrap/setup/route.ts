import { getDB, persist, uid, now, hashPassword } from "@/lib/db";
import { jsonError, ApiError, setSession } from "@/lib/auth";
import crypto from "crypto";

/** One-time private owner sign-in/bootstrap. Server-only env:
 *  OWNER_EMAIL + OWNER_SETUP_SECRET. On the first verified sign-in, the
 *  setup secret is hashed as the initial owner password, so the same two
 *  environment credentials work through the private control room afterwards.
 *  The bootstrap path then closes permanently, preventing duplicate owners.
 *  An explicitly supplied separate permanent password remains supported. */
export async function POST(req: Request) {
  try {
    const { email, setupSecret, fullName, password } = await req.json();
    const db = await getDB();
    if (db.meta.ownerInitialised || db.meta.setupSecretUsed) throw new ApiError(403, "Initialisation has already been completed.");
    const expectedEmail = process.env.OWNER_EMAIL?.trim();
    const expectedSecret = process.env.OWNER_SETUP_SECRET;
    if (!expectedEmail || !expectedSecret) throw new ApiError(503, "Bootstrap is not configured on this deployment.");

    const suppliedEmail = String(email || "").trim().toLowerCase();
    const ownerEmail = expectedEmail.toLowerCase();
    const okEmail = suppliedEmail === ownerEmail;
    const suppliedSetupSecret = String(setupSecret || "");
    const a = Buffer.from(suppliedSetupSecret), b = Buffer.from(expectedSecret);
    const okSecret = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!okEmail || !okSecret) throw new ApiError(403, "Bootstrap verification failed.");

    const initialPassword = typeof password === "string" && password ? password : suppliedSetupSecret;
    if (initialPassword.length < 12) throw new ApiError(400, "The owner credential must be at least 12 characters.");

    const existingOwner = db.users.find(u => u.role === "owner");
    if (existingOwner && existingOwner.email.toLowerCase() !== ownerEmail) {
      throw new ApiError(409, "An owner account already exists for a different email address.");
    }
    const existing = db.users.find(u => u.email.toLowerCase() === ownerEmail);
    if (existing && existing.role !== "owner") {
      throw new ApiError(409, "The configured owner email already belongs to another account.");
    }

    let user = existing;
    if (user) {
      user.fullName = String(fullName || "").trim() || user.fullName || "Platform Owner";
      user.passwordHash = hashPassword(initialPassword);
      user.status = "verified";
      user.plan = "premium";
      user.contactVerified = true;
    } else {
      user = {
        id: uid("u_"), fullName: String(fullName || "").trim() || "Platform Owner", email: ownerEmail,
        phone: "", passwordHash: hashPassword(initialPassword), role: "owner" as const,
        status: "verified" as const, createdAt: now(), avatarColor: "#4f46e5",
        plan: "premium" as const, contactVerified: true, notificationPrefs: { email: true, inApp: true },
      };
      db.users.push(user);
    }

    user.lastLoginAt = now();
    db.meta.ownerInitialised = true; db.meta.setupSecretUsed = true;
    db.auditLogs.unshift({ id: uid("al_"), actorId: user.id, action: existing ? "platform.bootstrap.claimed" : "platform.bootstrap", target: user.id, createdAt: now() });
    await persist();
    await setSession(user as any);
    return Response.json({ ok: true, role: "owner", initialised: true });
  } catch (e) { return jsonError(e); }
}
export async function GET() {
  const db = await getDB();
  return Response.json({ initialised: db.meta.ownerInitialised, configured: !!(process.env.OWNER_EMAIL && process.env.OWNER_SETUP_SECRET) });
}

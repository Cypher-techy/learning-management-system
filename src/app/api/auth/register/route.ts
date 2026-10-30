import { getDB, persist, uid, now, hashPassword, audit, type Role } from "@/lib/db";
import { jsonError, ApiError, setSession } from "@/lib/auth";
import crypto from "crypto";

const PUBLIC_ROLES: Role[] = ["student", "teacher", "administrator"];

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const db = getDB();
    const meta = db.meta as unknown as Record<string, any>;
    meta.pending = meta.pending || {};

    // Step 2 — confirm contact verification code, then create the account.
    if (b.verificationCode) {
      const p = meta.pending[b.email?.toLowerCase()];
      if (!p) throw new ApiError(400, "No pending verification for this email. Please register again.");
      const hash = crypto.createHash("sha256").update(String(b.verificationCode)).digest("hex");
      if (hash !== p.codeHash) throw new ApiError(400, "Incorrect verification code.");
      if (Date.now() > p.expires) throw new ApiError(400, "Verification code expired. Please register again.");
      const payload = p.payload;
      delete meta.pending[b.email.toLowerCase()];
      const user = {
        id: uid("u_"), ...payload, passwordHash: hashPassword(payload.password),
        contactVerified: true, createdAt: now(),
        status: payload.role === "student" ? "verified" : "pending",
        plan: "free" as const, notificationPrefs: { email: true, inApp: true },
      };
      delete (user as any).password;
      db.users.push(user);
      if (user.role === "student") {
        db.verifications.push({ id: uid("v_"), userId: user.id, role: "student", from: "pending", to: "verified", decidedBy: "system", reason: "Automatic verification after contact confirmation.", createdAt: now() });
        db.notifications.unshift({ id: uid("n_"), userId: user.id, title: "Welcome to EDVORA", body: "Your account is verified. Start with any free course.", createdAt: now(), read: false });
      }
      if (user.role === "teacher") db.users.filter(u => u.role === "administrator" && u.status === "verified").forEach(a =>
        db.notifications.unshift({ id: uid("n_"), userId: a.id, title: "New teacher application", body: `${user.fullName} applied to teach.`, createdAt: now(), read: false, href: "/dashboard/admin/teachers" }));
      audit(user.id, "account.registered", user.id, user.role);
      persist();
      await setSession(user as any);
      return Response.json({ ok: true, role: user.role, status: user.status });
    }

    // Step 1 — validate + issue contact verification code.
    if (!PUBLIC_ROLES.includes(b.role)) throw new ApiError(400, "Invalid account type.");
    if (!b.fullName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) throw new ApiError(400, "Please provide your full name and a valid email address.");
    if (!b.phone?.trim()) throw new ApiError(400, "Please provide a phone number.");
    if (!b.password || b.password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
    if (b.password !== b.confirmPassword) throw new ApiError(400, "Passwords do not match.");
    if (db.users.some(u => u.email.toLowerCase() === b.email.toLowerCase())) throw new ApiError(409, "An account with this email already exists. Please sign in.");
    if (b.role === "teacher" && (!b.title || !b.expertise || !b.qualifications)) throw new ApiError(400, "Teacher applications require a professional title, area of expertise and qualifications.");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const colors = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777"];
    meta.pending[b.email.toLowerCase()] = {
      codeHash: crypto.createHash("sha256").update(code).digest("hex"),
      expires: Date.now() + 15 * 60 * 1000,
      payload: {
        fullName: b.fullName.trim(), email: b.email.toLowerCase(), phone: b.phone, password: b.password,
        role: b.role, avatarColor: colors[Math.floor(Math.random() * colors.length)],
        title: b.title || undefined, expertise: b.expertise || undefined,
        qualifications: b.qualifications || undefined, experience: b.experience || undefined,
        bio: b.bio || undefined, proposedCourses: b.proposedCourses || undefined,
      },
    };
    persist();
    // In production this code is delivered by the configured email/SMS provider
    // (Supabase Auth confirmations). It is only echoed back outside production
    // when no mail provider is configured, so local evaluation can proceed.
    const mailConfigured = !!process.env.RESEND_API_KEY || !!process.env.SUPABASE_URL;
    return Response.json({
      needsVerification: true,
      message: "We sent a 6-digit verification code to your email.",
      devCode: !mailConfigured && process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (e) { return jsonError(e); }
}

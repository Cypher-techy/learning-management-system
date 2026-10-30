import { getDB, persist, uid, now, hashPassword, audit, type DB, type Role } from "@/lib/db";
import { jsonError, ApiError, setSession } from "@/lib/auth";
import crypto from "crypto";

const PUBLIC_ROLES: Role[] = ["student", "tutor", "administrator"];

type RegistrationPayload = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  avatarColor: string;
  title?: string;
  expertise?: string;
  qualifications?: string;
  experience?: string;
  bio?: string;
  proposedCourses?: string;
};

async function createAccount(db: DB, payload: RegistrationPayload, studentVerificationReason: string) {
  const user = {
    id: uid("u_"), ...payload, passwordHash: hashPassword(payload.password),
    contactVerified: true, createdAt: now(),
    status: payload.role === "student" ? "verified" as const : "pending" as const,
    plan: "free" as const, notificationPrefs: { email: true, inApp: true },
  };
  delete (user as any).password;
  db.users.push(user);
  if (user.role === "student") {
    db.verifications.push({ id: uid("v_"), userId: user.id, role: "student", from: "pending", to: "verified", decidedBy: "system", reason: studentVerificationReason, createdAt: now() });
    db.notifications.unshift({ id: uid("n_"), userId: user.id, title: "Welcome to Elimu Bora", body: "Your account is verified. Start with any free course.", createdAt: now(), read: false });
  }
  if (user.role === "tutor") db.users.filter(u => u.role === "administrator" && u.status === "verified").forEach(a =>
    db.notifications.unshift({ id: uid("n_"), userId: a.id, title: "New tutor application", body: `${user.fullName} applied to teach.`, createdAt: now(), read: false, href: "/dashboard/admin/tutors" }));
  audit(user.id, "account.registered", user.id, user.role);
  await persist();
  await setSession(user as any);
  return Response.json({ ok: true, role: user.role, status: user.status, autoVerified: user.role === "student" });
}

/** Deliver the verification code through Resend when configured.
 *  Returns false when no mail provider is set; throws a clear,
 *  learner-facing error when the provider rejects the send. */
async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Elimu Bora <edvoraplatform@gmail.com>",
        to: [email],
        subject: "Your Elimu Bora verification code",
        text: `Your Elimu Bora verification code is ${code}. It expires in 15 minutes. If you did not create an Elimu Bora account, you can ignore this email.`,
        html: `<p>Your Elimu Bora verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes. If you did not create an Elimu Bora account, you can ignore this email.</p>`,
      }),
    });
  } catch (e) {
    console.error("Elimu Bora: verification email request failed.", e);
    throw new ApiError(502, "We could not send your verification email. Please try again shortly.");
  }
  if (!res.ok) {
    console.error("Elimu Bora: verification email provider rejected the send.", res.status, await res.text().catch(() => ""));
    throw new ApiError(502, "We could not send your verification email. Please try again shortly.");
  }
  return true;
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const db = await getDB();
    const meta = db.meta as unknown as Record<string, any>;
    meta.pending = meta.pending || {};

    // Step 2 — confirm contact verification code, then create the account.
    if (b.verificationCode) {
      const p = meta.pending[b.email?.toLowerCase()];
      if (!p) throw new ApiError(400, "No pending verification for this email. Please register again.");
      const hash = crypto.createHash("sha256").update(String(b.verificationCode)).digest("hex");
      if (hash !== p.codeHash) throw new ApiError(400, "Incorrect verification code.");
      if (Date.now() > p.expires) throw new ApiError(400, "Verification code expired. Please register again.");
      const payload = p.payload as RegistrationPayload;
      delete meta.pending[b.email.toLowerCase()];
      return createAccount(db, payload, "Automatic verification after contact confirmation.");
    }

    // Step 1 — validate registration details. Students finish here;
    // tutor/administrator applicants continue to contact verification.
    if (!PUBLIC_ROLES.includes(b.role)) throw new ApiError(400, "Invalid account type.");
    if (!b.fullName?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "")) throw new ApiError(400, "Please provide your full name and a valid email address.");
    if (!b.phone?.trim()) throw new ApiError(400, "Please provide a phone number.");
    if (!b.password || b.password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
    if (b.password !== b.confirmPassword) throw new ApiError(400, "Passwords do not match.");
    if (db.users.some(u => u.email.toLowerCase() === b.email.toLowerCase())) throw new ApiError(409, "An account with this email already exists. Please sign in.");
    if (b.role === "tutor" && (!b.title || !b.expertise || !b.qualifications)) throw new ApiError(400, "Tutor applications require a professional title, area of expertise and qualifications.");

    const colors = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777"];
    const payload: RegistrationPayload = {
      fullName: b.fullName.trim(), email: b.email.toLowerCase(), phone: b.phone, password: b.password,
      role: b.role, avatarColor: colors[Math.floor(Math.random() * colors.length)],
      title: b.title || undefined, expertise: b.expertise || undefined,
      qualifications: b.qualifications || undefined, experience: b.experience || undefined,
      bio: b.bio || undefined, proposedCourses: b.proposedCourses || undefined,
    };

    // Students are auto-verified in one step: no email code, email-provider
    // dependency or approval wait. Tutor and administrator registrations
    // continue through contact verification and their review workflows.
    if (payload.role === "student") {
      delete meta.pending[payload.email];
      return createAccount(db, payload, "Automatic student verification at registration.");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    meta.pending[payload.email] = {
      codeHash: crypto.createHash("sha256").update(code).digest("hex"),
      expires: Date.now() + 15 * 60 * 1000,
      payload,
    };
    await persist();
    const emailSent = await sendVerificationEmail(payload.email, code);
    // The code is only ever echoed to the browser outside production, or
    // when the operator explicitly enables ALLOW_REGISTRATION_CODE_DISPLAY
    // for launch testing before an email provider is connected. Never
    // tell a learner "we sent a code" when nothing was actually sent.
    const showCode = !emailSent && (process.env.NODE_ENV !== "production" || process.env.ALLOW_REGISTRATION_CODE_DISPLAY === "true");
    if (!emailSent && !showCode) {
      delete meta.pending[payload.email];
      await persist();
      throw new ApiError(503, "Registration email is not configured yet. Please contact Elimu Bora support at edvoraplatform@gmail.com or +254 110 966 455.");
    }
    return Response.json({
      needsVerification: true,
      message: emailSent
        ? "We sent a 6-digit verification code to your email."
        : "Use this 6-digit verification code to finish creating your account.",
      devCode: showCode ? code : undefined,
    });
  } catch (e) { return jsonError(e); }
}

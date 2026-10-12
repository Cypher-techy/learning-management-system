import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { db, schema } from "../db";
import { logAuditStandalone } from "../services/audit";
import { sendEmail } from "../services/email";
import { getSettings } from "../services/settings";

function createAuth() {
  const e = env();
  return betterAuth({
    appName: "LMS",
    baseURL: e.NEXT_PUBLIC_APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        rateLimit: schema.rateLimits,
      },
    }),
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: e.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    },
    user: {
      additionalFields: {
        // `input: false` means these can never be set through sign-up or
        // profile-update requests; only server-side services change them.
        role: { type: "string", required: false, defaultValue: "student", input: false },
        banned: { type: "boolean", required: false, defaultValue: false, input: false },
        banReason: { type: "string", required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: e.REQUIRE_EMAIL_VERIFICATION,
      resetPasswordTokenExpiresIn: 60 * 60, // single-use, one hour
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your password",
          text: `Hello ${user.name},\n\nWe received a request to reset your password. The link below expires in one hour and can be used once.\n\nIf you did not ask for this, you can ignore this email.`,
          action: { label: "Reset password", url },
        });
      },
      onPasswordReset: async ({ user }) => {
        await db.insert(schema.notifications).values({
          userId: user.id,
          category: "security",
          title: "Your password was changed",
          body: "If this was not you, contact support immediately.",
          link: "/account",
        });
        await logAuditStandalone({
          actorId: user.id,
          action: "auth.password_reset",
          entityType: "user",
          entityId: user.id,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: e.REQUIRE_EMAIL_VERIFICATION,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Confirm your email address",
          text: `Hello ${user.name},\n\nPlease confirm your email address to finish setting up your account.`,
          action: { label: "Confirm email", url },
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: e.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 3 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const settings = await getSettings();
            if (!settings.registrationEnabled) {
              throw new APIError("FORBIDDEN", {
                message: "Registration is currently closed.",
              });
            }
            return { data: user };
          },
          // No `after` hook on purpose: sign-up runs inside a transaction, and
          // writing a row that references the new user from another
          // connection would wait on that uncommitted row forever. The
          // profile row is created on first use instead (every writer upserts).
        },
      },
      session: {
        create: {
          before: async (session) => {
            const [user] = await db
              .select({ banned: schema.users.banned })
              .from(schema.users)
              .where(eq(schema.users.id, session.userId));
            if (user?.banned) {
              throw new APIError("FORBIDDEN", {
                message: "This account has been suspended. Contact support for help.",
              });
            }
            return { data: session };
          },
        },
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

const globalStore = globalThis as unknown as { __lmsAuth?: Auth };

/** Lazily constructed so that importing this module needs no secrets. */
export function getAuth(): Auth {
  if (!globalStore.__lmsAuth) globalStore.__lmsAuth = createAuth();
  return globalStore.__lmsAuth;
}

/** Hash a password with the authentication provider's algorithm (scrypt). */
export async function hashPassword(password: string): Promise<string> {
  const ctx = await getAuth().$context;
  return ctx.password.hash(password);
}

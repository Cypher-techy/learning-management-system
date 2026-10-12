import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optional = () => z.preprocess(emptyToUndefined, z.string().optional());
const bool = (fallback: boolean) =>
  z.preprocess(
    (v) => (v === undefined || v === "" ? fallback : v === "true" || v === true),
    z.boolean(),
  );

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),
  DATABASE_URL: optional(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters. See .env.example."),
  REQUIRE_EMAIL_VERIFICATION: bool(false),

  SMTP_HOST: optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: optional(),
  SMTP_PASSWORD: optional(),
  EMAIL_FROM: z.string().default("Learning Platform <no-reply@example.com>"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  S3_ENDPOINT: optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optional(),
  S3_ACCESS_KEY_ID: optional(),
  S3_SECRET_ACCESS_KEY: optional(),
  S3_FORCE_PATH_STYLE: bool(false),

  CGS_WEBSITE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),

  PAYMENT_PROVIDER: z.enum(["disabled", "mpesa", "sandbox"]).default("disabled"),
  MPESA_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  MPESA_CONSUMER_KEY: optional(),
  MPESA_CONSUMER_SECRET: optional(),
  MPESA_SHORTCODE: optional(),
  MPESA_PASSKEY: optional(),
  MPESA_CALLBACK_SECRET: optional(),

  HEALTHCHECK_TOKEN: optional(),
  E2E_TEST_MODE: bool(false),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated server environment. Parsed on first use (not at import time) so
 * that `next build` does not need runtime secrets.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * True for a real production deployment.
 *
 * Automated browser tests run a production build locally and need the
 * development-only conveniences (sandbox payments, no sign-in throttling).
 * E2E_TEST_MODE grants that, but ONLY when the site address is localhost, so
 * setting it on a public deployment has no effect.
 */
export function isProductionRuntime(): boolean {
  const e = env();
  if (e.NODE_ENV !== "production") return false;
  if (!e.E2E_TEST_MODE) return true;
  const host = new URL(e.NEXT_PUBLIC_APP_URL).hostname;
  return !(host === "localhost" || host === "127.0.0.1");
}

/** Test hook. */
export function resetEnvCache() {
  cached = undefined;
}

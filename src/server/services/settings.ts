import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "../db";
import { AppError } from "../errors";
import { assertCan, type Actor } from "../permissions";
import { logAudit } from "./audit";

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full http(s) URL or leave empty.");

export const settingsSchema = z.object({
  platformName: z.string().trim().min(2).max(60).default("CGS Academy"),
  platformDescription: z
    .string()
    .trim()
    .max(300)
    .default("Practical online courses with assessments and verifiable certificates."),
  organizationName: z.string().trim().max(120).default("Cypher Green Systems"),
  supportEmail: z.union([z.literal(""), z.string().trim().email()]).default(""),
  supportPhone: z.string().trim().max(40).default(""),
  /** Official CGS website. Empty means the footer attribution is not linked. */
  cgsWebsiteUrl: optionalUrl.default(""),
  logoFileId: z.string().uuid().nullable().default(null),
  theme: z.enum(["evergreen", "ocean", "slate", "plum"]).default("evergreen"),
  currency: z.string().trim().length(3).toUpperCase().default("KES"),
  registrationEnabled: z.boolean().default(true),
  selfEnrollmentEnabled: z.boolean().default(true),
  /** When true, instructors must submit courses for administrator review. */
  courseApprovalRequired: z.boolean().default(true),
  emailNotificationsEnabled: z.boolean().default(true),
  maxUploadMb: z.number().int().min(1).max(500).default(25),
  allowedUploadExtensions: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9]{1,8}$/))
    .default([
      "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "zip",
      "png", "jpg", "jpeg", "gif", "webp", "mp4", "webm", "mp3",
    ]),
  /** Default completion rules applied to newly created courses. */
  defaultRequireAllLessons: z.boolean().default(true),
  defaultRequireAssessments: z.boolean().default(true),
  defaultRequireAssignments: z.boolean().default(true),
  termsUrl: optionalUrl.default(""),
  privacyUrl: optionalUrl.default(""),
});

export type PlatformSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: PlatformSettings = settingsSchema.parse({});

export async function getSettings(conn: DbOrTx = db): Promise<PlatformSettings> {
  const rows = await conn.select().from(schema.platformSettings);
  const stored: Record<string, unknown> = {};
  for (const row of rows) stored[row.key] = row.value;
  const parsed = settingsSchema.safeParse(stored);
  if (parsed.success) return parsed.data;
  // A corrupt value must not take the platform down: fall back per key.
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PlatformSettings)[]) {
    if (!(key in stored)) continue;
    const field = settingsSchema.shape[key].safeParse(stored[key]);
    if (field.success) result[key] = field.data;
  }
  return result as PlatformSettings;
}

export async function updateSettings(actor: Actor, patch: Partial<PlatformSettings>) {
  assertCan(actor, "settings.manage");
  // Validate and write ONLY the keys that were submitted. Parsing the whole
  // object would fill in defaults for everything else and overwrite settings
  // the administrator never touched.
  const keys = (Object.keys(patch) as (keyof PlatformSettings)[]).filter(
    (key) => key in settingsSchema.shape && patch[key] !== undefined,
  );
  if (keys.length === 0) return;
  const validated: Partial<Record<keyof PlatformSettings, unknown>> = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const key of keys) {
    const result = settingsSchema.shape[key].safeParse(patch[key]);
    if (result.success) validated[key] = result.data;
    else fieldErrors[key] = result.error.issues.map((issue) => issue.message);
  }
  const invalidKeys = Object.keys(fieldErrors);
  if (invalidKeys.length > 0) {
    throw new AppError("VALIDATION", `${invalidKeys[0]}: ${fieldErrors[invalidKeys[0]!]![0]}`, fieldErrors);
  }
  await db.transaction(async (tx) => {
    for (const key of keys) {
      const value = validated[key];
      if (value === null) {
        // "No value" is stored as the absence of the row, which reads back as the default.
        await tx.delete(schema.platformSettings).where(eq(schema.platformSettings.key, key));
        continue;
      }
      await tx
        .insert(schema.platformSettings)
        .values({ key, value, updatedBy: actor.id })
        .onConflictDoUpdate({
          target: schema.platformSettings.key,
          set: { value, updatedBy: actor.id, updatedAt: new Date() },
        });
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: "settings.update",
      entityType: "platform_settings",
      metadata: { keys },
    });
  });
}

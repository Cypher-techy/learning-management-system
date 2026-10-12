import { randomInt } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { z } from "zod";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { db, schema, type DbOrTx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, can, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { withNotifications } from "./notifications";
import { getSettings } from "./settings";

const { certificates, certificateTemplates, courses, users } = schema;

export type Certificate = typeof certificates.$inferSelect;
type EnrollmentRow = typeof schema.enrollments.$inferSelect;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alike characters

function randomBlock(length: number) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** e.g. CERT-2026-K7QM2-9XHTB: 50 random bits, so numbers cannot be guessed. */
export function generateCertificateNumber(date = new Date()) {
  return `CERT-${date.getUTCFullYear()}-${randomBlock(5)}-${randomBlock(5)}`;
}

export const CERTIFICATE_NUMBER = /^CERT-\d{4}-[A-Z2-9]{5}-[A-Z2-9]{5}$/;

async function defaultTemplate(conn: DbOrTx) {
  const [template] = await conn
    .select()
    .from(certificateTemplates)
    .orderBy(desc(certificateTemplates.isDefault), certificateTemplates.createdAt)
    .limit(1);
  return template ?? null;
}

/**
 * Issues the certificate for a completed enrollment. This is the only code
 * path that creates certificates and it is never exposed to learners
 * directly; it is called from the completion evaluator. Idempotent.
 */
export async function issueCertificate(conn: DbOrTx, enrollment: EnrollmentRow, score: number | null) {
  if (enrollment.status !== "completed") {
    throw conflict("A certificate can only be issued for a completed enrollment.");
  }
  const [existing] = await conn.select().from(certificates).where(eq(certificates.enrollmentId, enrollment.id));
  if (existing) return existing;
  const [[user], [course], template] = await Promise.all([
    conn.select({ name: users.name }).from(users).where(eq(users.id, enrollment.userId)),
    conn.select({ title: courses.title }).from(courses).where(eq(courses.id, enrollment.courseId)),
    defaultTemplate(conn),
  ]);
  const [created] = await conn
    .insert(certificates)
    .values({
      number: generateCertificateNumber(),
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      templateId: template?.id ?? null,
      learnerName: user!.name,
      courseTitle: course!.title,
      score: score === null ? null : Math.round(score * 10) / 10,
    })
    .onConflictDoNothing({ target: certificates.enrollmentId })
    .returning();
  if (created) return created;
  const [raced] = await conn.select().from(certificates).where(eq(certificates.enrollmentId, enrollment.id));
  return raced!;
}

// --- Verification ----------------------------------------------------------

export type VerificationResult =
  | { found: false }
  | {
      found: true;
      status: "valid" | "revoked";
      number: string;
      learnerName: string;
      courseTitle: string;
      issuedAt: Date;
      revokedAt: Date | null;
      issuer: string;
    };

/** Public lookup. Returns only what is needed to establish authenticity. */
export async function verifyCertificate(rawNumber: string): Promise<VerificationResult> {
  const number = rawNumber.trim().toUpperCase();
  if (!CERTIFICATE_NUMBER.test(number)) return { found: false };
  const [cert] = await db.select().from(certificates).where(eq(certificates.number, number));
  if (!cert) return { found: false };
  const settings = await getSettings();
  return {
    found: true,
    status: cert.status,
    number: cert.number,
    learnerName: cert.learnerName,
    courseTitle: cert.courseTitle,
    issuedAt: cert.issuedAt,
    revokedAt: cert.revokedAt,
    issuer: settings.organizationName || settings.platformName,
  };
}

// --- Administration --------------------------------------------------------

export async function revokeCertificate(actor: Actor, certificateId: string, reason: string) {
  assertCan(actor, "certificate.manage");
  if (reason.trim().length < 5) throw invalid("Give a reason for revoking this certificate.");
  await withNotifications(async (tx, notify) => {
    const [cert] = await tx.select().from(certificates).where(eq(certificates.id, certificateId));
    if (!cert) throw notFound("The certificate");
    if (cert.status === "revoked") throw conflict("This certificate is already revoked.");
    await tx
      .update(certificates)
      .set({ status: "revoked", revokedAt: new Date(), revokedBy: actor.id, revokeReason: reason.trim() })
      .where(eq(certificates.id, certificateId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "certificate.revoke",
      entityType: "certificate",
      entityId: certificateId,
      metadata: { number: cert.number, reason: reason.trim() },
    });
    await notify({
      userIds: [cert.userId],
      category: "certificate",
      title: `Your certificate for ${cert.courseTitle} was revoked`,
      body: reason.trim(),
      link: "/learn/certificates",
    });
  });
}

export async function reinstateCertificate(actor: Actor, certificateId: string) {
  assertCan(actor, "certificate.manage");
  await db.transaction(async (tx) => {
    const [cert] = await tx.select().from(certificates).where(eq(certificates.id, certificateId));
    if (!cert) throw notFound("The certificate");
    if (cert.status === "valid") throw conflict("This certificate is already valid.");
    await tx
      .update(certificates)
      .set({ status: "valid", revokedAt: null, revokedBy: null, revokeReason: null })
      .where(eq(certificates.id, certificateId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "certificate.reinstate",
      entityType: "certificate",
      entityId: certificateId,
      metadata: { number: cert.number },
    });
  });
}

export const templateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  heading: z.string().trim().min(2).max(80),
  body: z.string().trim().min(10).max(400),
  issuerName: z.string().trim().max(120).default(""),
  signatoryName: z.string().trim().max(80).default(""),
  signatoryTitle: z.string().trim().max(80).default(""),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #0f5c4d."),
  showScore: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

export async function saveTemplate(actor: Actor, templateId: string | null, input: z.infer<typeof templateSchema>) {
  assertCan(actor, "certificate.manage");
  const data = templateSchema.parse(input);
  await db.transaction(async (tx) => {
    if (data.isDefault) await tx.update(certificateTemplates).set({ isDefault: false });
    if (templateId) {
      await tx.update(certificateTemplates).set(data).where(eq(certificateTemplates.id, templateId));
    } else {
      await tx.insert(certificateTemplates).values(data);
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: templateId ? "certificate_template.update" : "certificate_template.create",
      entityType: "certificate_template",
      entityId: templateId,
    });
  });
}

export async function deleteTemplate(actor: Actor, templateId: string) {
  assertCan(actor, "certificate.manage");
  await db.delete(certificateTemplates).where(eq(certificateTemplates.id, templateId));
  await logAudit(db, {
    actorId: actor.id,
    action: "certificate_template.delete",
    entityType: "certificate_template",
    entityId: templateId,
  });
}

// --- Reading ---------------------------------------------------------------

export async function listMyCertificates(actor: Actor) {
  assertSignedIn(actor);
  return db
    .select()
    .from(certificates)
    .where(eq(certificates.userId, actor.id))
    .orderBy(desc(certificates.issuedAt));
}

/** The owner, or staff with `certificate.manage`, may download the PDF. */
export async function getCertificateForDownload(actor: Actor, certificateId: string) {
  assertSignedIn(actor);
  const [cert] = await db.select().from(certificates).where(eq(certificates.id, certificateId));
  if (!cert) throw notFound("The certificate");
  if (cert.userId !== actor.id && !can(actor, "certificate.manage")) {
    // Do not reveal that the certificate exists.
    throw notFound("The certificate");
  }
  if (cert.status === "revoked" && cert.userId === actor.id && !can(actor, "certificate.manage")) {
    throw forbidden("This certificate has been revoked and can no longer be downloaded.");
  }
  return cert;
}

// --- PDF rendering ---------------------------------------------------------

/** Standard PDF fonts cover Latin-1 only; anything else is transliterated. */
function latin(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) out.push(line);
  return out;
}

export async function renderCertificatePdf(cert: Certificate): Promise<Uint8Array> {
  const [template] = cert.templateId
    ? await db.select().from(certificateTemplates).where(eq(certificateTemplates.id, cert.templateId))
    : [];
  const tpl = template ?? (await defaultTemplate(db));
  const settings = await getSettings();
  const issuer = tpl?.issuerName || settings.organizationName || settings.platformName;
  const accent = hexToRgb(tpl?.accentColor ?? "#0f5c4d");
  const ink = rgb(0.1, 0.12, 0.14);
  const muted = rgb(0.4, 0.43, 0.46);

  const pdf = await PDFDocument.create();
  pdf.setTitle(latin(`${cert.courseTitle} - ${cert.learnerName}`));
  pdf.setAuthor(latin(issuer));
  pdf.setSubject(`Certificate ${cert.number}`);
  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: accent, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: accent, borderWidth: 0.75 });

  const center = (text: string, y: number, font: PDFFont, size: number, color = ink) => {
    const t = latin(text);
    page.drawText(t, { x: (width - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  center(issuer.toUpperCase(), height - 92, sans, 12, muted);
  center(tpl?.heading ?? "Certificate of Completion", height - 150, serifBold, 34, accent);

  const body = (tpl?.body ?? "This certifies that {{learner}} has successfully completed {{course}}.")
    .replace(/\{\{\s*date\s*\}\}/g, formatDate(cert.issuedAt));
  const [before, afterLearner = ""] = body.split(/\{\{\s*learner\s*\}\}/);
  const [between, afterCourse = ""] = afterLearner.split(/\{\{\s*course\s*\}\}/);

  let y = height - 205;
  if (before?.trim()) {
    center(before.trim(), y, serif, 15, muted);
    y -= 52;
  }
  center(cert.learnerName, y, serifBold, 30);
  y -= 40;
  if (between?.trim()) {
    center(between.trim(), y, serif, 15, muted);
    y -= 38;
  }
  for (const line of wrap(latin(cert.courseTitle), serifBold, 22, width - 200)) {
    center(line, y, serifBold, 22);
    y -= 28;
  }
  if (afterCourse.trim().replace(/^\./, "").trim()) {
    for (const line of wrap(latin(afterCourse.trim()), serif, 13, width - 240)) {
      center(line, y - 4, serif, 13, muted);
      y -= 18;
    }
  }
  if (tpl?.showScore && cert.score !== null) {
    center(`Final score: ${cert.score}%`, y - 14, sans, 12, muted);
  }

  const footY = 96;
  page.drawText(latin(`Issued: ${formatDate(cert.issuedAt)}`), { x: 70, y: footY, size: 11, font: sans, color: ink });
  page.drawText(`Certificate no. ${cert.number}`, { x: 70, y: footY - 16, size: 11, font: sans, color: ink });
  const verifyUrl = `${env().NEXT_PUBLIC_APP_URL}/verify/${cert.number}`;
  page.drawText(latin(`Verify at ${verifyUrl}`), { x: 70, y: footY - 32, size: 9, font: sans, color: muted });

  if (tpl?.signatoryName) {
    const name = latin(tpl.signatoryName);
    const right = width - 70;
    page.drawLine({ start: { x: right - 200, y: footY + 6 }, end: { x: right, y: footY + 6 }, thickness: 0.75, color: muted });
    page.drawText(name, { x: right - 100 - serifBold.widthOfTextAtSize(name, 12) / 2, y: footY - 10, size: 12, font: serifBold, color: ink });
    if (tpl.signatoryTitle) {
      const title = latin(tpl.signatoryTitle);
      page.drawText(title, { x: right - 100 - sans.widthOfTextAtSize(title, 10) / 2, y: footY - 24, size: 10, font: sans, color: muted });
    }
  }
  if (cert.status === "revoked") {
    const label = "REVOKED";
    page.drawText(label, {
      x: (width - sans.widthOfTextAtSize(label, 90)) / 2,
      y: height / 2 - 30,
      size: 90,
      font: sans,
      color: rgb(0.8, 0.1, 0.1),
      opacity: 0.25,
    });
  }
  return pdf.save();
}

export async function certificateForEnrollment(conn: DbOrTx, userId: string, courseId: string) {
  const [cert] = await conn
    .select()
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
  return cert ?? null;
}

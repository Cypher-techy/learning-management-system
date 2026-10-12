import { describe, expect, it } from "vitest";
import { formatMoney, slugify, toCsv } from "@/lib/format";
import { normalizeKenyanPhone, parseStkCallback } from "@/server/payments/providers";
import { DEFAULT_ROLE_PERMISSIONS, resolvePermissions } from "@/server/permissions";
import { gradeAnswer, startBlocker, type Assessment } from "@/server/services/assessments";
import { generateCertificateNumber, CERTIFICATE_NUMBER } from "@/server/services/certificates";
import { contentMatchesExtension } from "@/server/services/files";
import { settingsSchema } from "@/server/services/settings";

const option = (id: string, isCorrect: boolean) => ({ id, questionId: "q", text: id, isCorrect, position: 0 });
const question = (type: string, marks: number, options: ReturnType<typeof option>[] = [], acceptedAnswers: string[] = []) =>
  ({ id: "q", bankId: "b", type, text: "?", explanation: "", marks, mediaFileId: null, acceptedAnswers, createdAt: new Date(), updatedAt: new Date(), options }) as never;
const answer = (selectedOptionIds: string[] = [], textAnswer: string | null = null, fileId: string | null = null) => ({
  selectedOptionIds,
  textAnswer,
  fileId,
});

describe("gradeAnswer", () => {
  const mc = question("multiple_choice", 4, [option("a", false), option("b", true)]);
  const ms = question("multiple_select", 3, [option("a", true), option("b", true), option("c", false)]);

  it("grades single-answer questions", () => {
    expect(gradeAnswer(mc, answer(["b"]), 0)).toEqual({ marks: 4, needsManual: false });
    expect(gradeAnswer(mc, answer(["a"]), 0)).toEqual({ marks: 0, needsManual: false });
    expect(gradeAnswer(mc, undefined, 0)).toEqual({ marks: 0, needsManual: false });
  });

  it("grades multiple-select as all-or-nothing", () => {
    expect(gradeAnswer(ms, answer(["a", "b"]), 0).marks).toBe(3);
    expect(gradeAnswer(ms, answer(["b", "a"]), 0).marks).toBe(3);
    expect(gradeAnswer(ms, answer(["a"]), 0).marks).toBe(0);
    expect(gradeAnswer(ms, answer(["a", "b", "c"]), 0).marks).toBe(0);
  });

  it("deducts for wrong answers but never for blanks", () => {
    expect(gradeAnswer(mc, answer(["a"]), 25).marks).toBe(-1);
    expect(gradeAnswer(mc, answer([]), 25).marks).toBe(0);
  });

  it("matches short answers ignoring case and spacing", () => {
    const sa = question("short_answer", 2, [], ["Dar es Salaam"]);
    expect(gradeAnswer(sa, answer([], "  dar   ES salaam "), 0).marks).toBe(2);
    expect(gradeAnswer(sa, answer([], "Dodoma"), 0).marks).toBe(0);
    expect(gradeAnswer(question("short_answer", 2), answer([], "anything"), 0)).toEqual({ marks: null, needsManual: true });
  });

  it("leaves essays and uploads for a human, unless nothing was submitted", () => {
    expect(gradeAnswer(question("essay", 10), answer([], "An essay"), 0)).toEqual({ marks: null, needsManual: true });
    expect(gradeAnswer(question("essay", 10), answer([], "   "), 0)).toEqual({ marks: 0, needsManual: false });
    expect(gradeAnswer(question("file_upload", 10), answer([], null, "file-id"), 0).needsManual).toBe(true);
    expect(gradeAnswer(question("file_upload", 10), answer(), 0)).toEqual({ marks: 0, needsManual: false });
  });
});

describe("startBlocker", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const a = (patch: Partial<Assessment>) => ({ startsAt: null, endsAt: null, maxAttempts: 1, ...patch }) as Assessment;
  it("reports why an attempt cannot start", () => {
    expect(startBlocker(a({}), 0, now)).toBeNull();
    expect(startBlocker(a({ startsAt: new Date("2026-06-02T00:00:00Z") }), 0, now)).toBe("not_open");
    expect(startBlocker(a({ endsAt: new Date("2026-06-01T12:00:00Z") }), 0, now)).toBe("closed");
    expect(startBlocker(a({ maxAttempts: 2 }), 2, now)).toBe("no_attempts_left");
  });
});

describe("permissions", () => {
  it("gives administrators everything regardless of overrides", () => {
    const set = resolvePermissions("admin", [{ role: "admin", permission: "user.manage", allowed: false }]);
    expect(set.has("user.manage")).toBe(true);
  });
  it("applies only delegable overrides", () => {
    const set = resolvePermissions("instructor", [
      { role: "instructor", permission: "course.create", allowed: false },
      { role: "instructor", permission: "settings.manage", allowed: true },
      { role: "student", permission: "grading.manage", allowed: true },
    ]);
    expect(set.has("course.create")).toBe(false);
    expect(set.has("settings.manage")).toBe(false);
    expect(set.has("grading.manage")).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.student).toEqual([]);
  });
});

describe("M-Pesa helpers", () => {
  it("normalises Kenyan phone numbers", () => {
    for (const input of ["0712345678", "+254712345678", "254 712 345 678", "712345678"]) {
      expect(normalizeKenyanPhone(input)).toBe("254712345678");
    }
    expect(normalizeKenyanPhone("0112345678")).toBe("254112345678");
    expect(() => normalizeKenyanPhone("12345")).toThrow();
    expect(() => normalizeKenyanPhone("0812345678")).toThrow();
  });

  it("parses successful and failed STK callbacks", () => {
    const ok = JSON.stringify({
      Body: {
        stkCallback: {
          MerchantRequestID: "m1",
          CheckoutRequestID: "ws_CO_1",
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: 2500 },
              { Name: "MpesaReceiptNumber", Value: "QWE123RTY" },
              { Name: "PhoneNumber", Value: 254712345678 },
            ],
          },
        },
      },
    });
    expect(parseStkCallback(ok)).toEqual({
      providerReference: "ws_CO_1",
      outcome: "succeeded",
      receiptNumber: "QWE123RTY",
      amountCents: 250000,
      failureReason: undefined,
    });
    const cancelled = JSON.stringify({
      Body: { stkCallback: { CheckoutRequestID: "ws_CO_2", ResultCode: 1032, ResultDesc: "Request cancelled by user" } },
    });
    expect(parseStkCallback(cancelled)).toMatchObject({ outcome: "failed", failureReason: "Request cancelled by user" });
    expect(parseStkCallback("not json")).toBeNull();
    expect(parseStkCallback(JSON.stringify({ Body: {} }))).toBeNull();
  });
});

describe("utilities", () => {
  it("builds safe slugs", () => {
    expect(slugify("  Intro to Agroforestry: Part 1! ")).toBe("intro-to-agroforestry-part-1");
    expect(slugify("Café & Crème")).toBe("cafe-creme");
  });
  it("formats money", () => {
    expect(formatMoney(0, "KES")).toBe("Free");
    expect(formatMoney(250000, "KES")).toMatch(/2,500/);
  });
  it("escapes CSV and neutralises formulas", () => {
    const csv = toCsv([{ name: 'Ann "A" Lee', note: "=HYPERLINK(1)", n: 3 }]);
    expect(csv.split("\r\n")[1]).toBe('"Ann ""A"" Lee",\'=HYPERLINK(1),3');
  });
  it("generates unguessable, well-formed certificate numbers", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateCertificateNumber()));
    expect(seen.size).toBe(500);
    for (const n of seen) expect(n).toMatch(CERTIFICATE_NUMBER);
  });
  it("checks file signatures", () => {
    expect(contentMatchesExtension("pdf", Buffer.from("%PDF-1.7"))).toBe(true);
    expect(contentMatchesExtension("pdf", Buffer.from("<html>"))).toBe(false);
    expect(contentMatchesExtension("png", Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true);
    expect(contentMatchesExtension("docx", Buffer.from("PK\u0003\u0004"))).toBe(true);
    expect(contentMatchesExtension("exe", Buffer.from("MZ"))).toBe(false);
  });
  it("validates settings and rejects unsafe URLs", () => {
    expect(settingsSchema.parse({}).cgsWebsiteUrl).toBe("");
    expect(settingsSchema.safeParse({ cgsWebsiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsSchema.safeParse({ cgsWebsiteUrl: "https://example.org" }).success).toBe(true);
  });
});

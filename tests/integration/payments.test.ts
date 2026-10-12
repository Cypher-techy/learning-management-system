import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import {
  setPaymentProvider,
  signSandboxBody,
  type CallbackRequest,
  type PaymentOutcome,
  type PaymentProvider,
} from "@/server/payments/providers";
import type { Actor } from "@/server/permissions";
import {
  decideRefund,
  getMyPayment,
  handlePaymentCallback,
  requestRefund,
  settlePayment,
  startCheckout,
} from "@/server/services/payments";
import { getLessonAccess } from "@/server/services/progress";
import { expectAppError, makeCourse, makeUser, type CourseFixture } from "../helpers";

const SECRET = "provider-shared-secret";

/** A provider with signed callbacks and a server-to-server status check. */
class FakeProvider implements PaymentProvider {
  readonly id = "sandbox" as const;
  readonly label = "Fake";
  readonly isSandbox = true;
  readonly supportedCurrencies = ["KES"];
  /** What the provider's own records say, keyed by reference. */
  ledger = new Map<string, PaymentOutcome["outcome"]>();
  queries = 0;
  normalizePhone = (p: string) => p;
  async initiate(input: { transactionId: string }) {
    const providerReference = `REF-${input.transactionId}`;
    this.ledger.set(providerReference, "pending");
    return { providerReference, instructions: "Approve on your phone." };
  }
  async parseCallback(request: CallbackRequest) {
    if (request.headers.get("x-signature") !== signSandboxBody(request.rawBody, SECRET)) return null;
    return JSON.parse(request.rawBody) as PaymentOutcome;
  }
  async queryStatus(providerReference: string): Promise<PaymentOutcome> {
    this.queries += 1;
    return { providerReference, outcome: this.ledger.get(providerReference) ?? "failed" };
  }
}

function callback(outcome: PaymentOutcome, secret = SECRET): CallbackRequest {
  const rawBody = JSON.stringify(outcome);
  return { token: "", rawBody, headers: new Headers({ "x-signature": signSandboxBody(rawBody, secret) }) };
}

let provider: FakeProvider;
let instructor: Actor;
let paid: CourseFixture;

beforeAll(async () => {
  provider = new FakeProvider();
  setPaymentProvider(provider);
  instructor = await makeUser("instructor");
  paid = await makeCourse(instructor, { priceCents: 250000 });
});

afterAll(() => setPaymentProvider(undefined));

async function enrollmentsOf(userId: string) {
  return db
    .select()
    .from(schema.enrollments)
    .where(and(eq(schema.enrollments.userId, userId), eq(schema.enrollments.courseId, paid.course.id)));
}

async function transactionsOf(userId: string) {
  return db.select().from(schema.paymentTransactions).where(eq(schema.paymentTransactions.userId, userId));
}

describe("checkout", () => {
  it("creates only a pending transaction and grants no access", async () => {
    const student = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    expect(transaction.status).toBe("pending");
    expect(transaction.amountCents).toBe(250000);
    expect(await enrollmentsOf(student.id)).toHaveLength(0);
    await expectAppError(getLessonAccess(student, paid.lessonIds[0]!), "FORBIDDEN");
  });

  it("does not create a second transaction for an immediate retry", async () => {
    const student = await makeUser("student");
    const first = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    const second = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    expect(second.transaction.id).toBe(first.transaction.id);
    expect(await transactionsOf(student.id)).toHaveLength(1);
  });

  it("is unavailable when payments are disabled", async () => {
    setPaymentProvider(null);
    const student = await makeUser("student");
    await expectAppError(startCheckout(student, paid.course.id, { phone: "0712345678" }), "UNAVAILABLE");
    setPaymentProvider(provider);
  });
});

describe("callbacks", () => {
  it("rejects a callback that is not authentic", async () => {
    const student = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    provider.ledger.set(transaction.providerReference, "succeeded");

    const forged = callback({ providerReference: transaction.providerReference, outcome: "succeeded" }, "wrong-secret");
    expect(await handlePaymentCallback("sandbox", forged)).toBeNull();
    // A callback addressed to a provider that is not configured is ignored too.
    expect(await handlePaymentCallback("mpesa", callback({ providerReference: transaction.providerReference, outcome: "succeeded" }))).toBeNull();

    expect((await transactionsOf(student.id))[0]!.status).toBe("pending");
    expect(await enrollmentsOf(student.id)).toHaveLength(0);
  });

  it("does not activate enrollment when the provider cannot confirm the payment", async () => {
    const student = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    // Correctly signed "success", but the provider's own ledger still says pending.
    const result = await handlePaymentCallback(
      "sandbox",
      callback({ providerReference: transaction.providerReference, outcome: "succeeded", amountCents: 250000 }),
    );
    expect(result).toBe("unconfirmed");
    expect((await transactionsOf(student.id))[0]!.status).toBe("pending");
    expect(await enrollmentsOf(student.id)).toHaveLength(0);
  });

  it("does not activate enrollment for an underpayment", async () => {
    const student = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    provider.ledger.set(transaction.providerReference, "succeeded");
    const result = await handlePaymentCallback(
      "sandbox",
      callback({ providerReference: transaction.providerReference, outcome: "succeeded", amountCents: 100 }),
    );
    expect(result).toBe("failed");
    expect(await enrollmentsOf(student.id)).toHaveLength(0);
  });

  it("ignores callbacks for unknown references", async () => {
    provider.ledger.set("REF-does-not-exist", "succeeded");
    const result = await handlePaymentCallback("sandbox", callback({ providerReference: "REF-does-not-exist", outcome: "succeeded" }));
    expect(result).toBe("unknown_reference");
  });

  it("activates enrollment after a verified payment", async () => {
    const student = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    provider.ledger.set(transaction.providerReference, "succeeded");
    const result = await handlePaymentCallback(
      "sandbox",
      callback({ providerReference: transaction.providerReference, outcome: "succeeded", amountCents: 250000, receiptNumber: "RCPT1" }),
    );
    expect(result).toBe("activated");
    const [row] = await transactionsOf(student.id);
    expect(row).toMatchObject({ status: "succeeded", receiptNumber: "RCPT1" });
    const enrolled = await enrollmentsOf(student.id);
    expect(enrolled).toHaveLength(1);
    expect(enrolled[0]).toMatchObject({ status: "active", source: "purchase" });
    await expect(getLessonAccess(student, paid.lessonIds[0]!)).resolves.toBeTruthy();
  });

  it("handles duplicate and concurrent callbacks idempotently", async () => {
    const student = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });
    provider.ledger.set(transaction.providerReference, "succeeded");
    const outcome: PaymentOutcome = {
      providerReference: transaction.providerReference,
      outcome: "succeeded",
      amountCents: 250000,
      receiptNumber: "RCPT2",
    };

    const results = await Promise.all([
      handlePaymentCallback("sandbox", callback(outcome)),
      handlePaymentCallback("sandbox", callback(outcome)),
      handlePaymentCallback("sandbox", callback(outcome)),
    ]);
    expect(results.filter((r) => r === "activated")).toHaveLength(1);
    expect(results.filter((r) => r === "already_processed")).toHaveLength(2);
    expect(await handlePaymentCallback("sandbox", callback(outcome))).toBe("already_processed");
    // A late "failed" callback must not undo a settled payment.
    expect(await settlePayment("sandbox", { providerReference: transaction.providerReference, outcome: "failed" })).toBe("already_processed");

    expect(await transactionsOf(student.id)).toHaveLength(1);
    expect((await transactionsOf(student.id))[0]!.status).toBe("succeeded");
    expect(await enrollmentsOf(student.id)).toHaveLength(1);
    const notices = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, student.id));
    expect(notices.filter((n) => n.category === "enrollment")).toHaveLength(1);
  });
});

describe("purchase records and refunds", () => {
  it("keeps payment records private and lets only authorized staff decide refunds", async () => {
    const admin = await makeUser("admin");
    const student = await makeUser("student");
    const stranger = await makeUser("student");
    const { transaction } = await startCheckout(student, paid.course.id, { phone: "0712345678" });

    await expectAppError(getMyPayment(stranger, transaction.id), "NOT_FOUND");
    await expectAppError(requestRefund(student, transaction.id, "I would like my money back please"), "CONFLICT");

    provider.ledger.set(transaction.providerReference, "succeeded");
    await handlePaymentCallback("sandbox", callback({ providerReference: transaction.providerReference, outcome: "succeeded" }));
    await expectAppError(requestRefund(stranger, transaction.id, "I would like my money back please"), "NOT_FOUND");
    await requestRefund(student, transaction.id, "I enrolled in the wrong course by mistake.");
    await expectAppError(requestRefund(student, transaction.id, "Asking a second time for a refund."), "CONFLICT");

    const [refund] = await db.select().from(schema.refunds).where(eq(schema.refunds.transactionId, transaction.id));
    await expectAppError(decideRefund(student, refund!.id, "approve", ""), "FORBIDDEN");
    await expectAppError(decideRefund(instructor, refund!.id, "approve", ""), "FORBIDDEN");
    await decideRefund(admin, refund!.id, "approve", "Approved; reversed in the provider portal.");

    expect((await transactionsOf(student.id))[0]!.status).toBe("refunded");
    expect((await enrollmentsOf(student.id))[0]!.status).toBe("cancelled");
    await expectAppError(getLessonAccess(student, paid.lessonIds[0]!), "FORBIDDEN");
    await expectAppError(decideRefund(admin, refund!.id, "reject", ""), "CONFLICT");
  });
});

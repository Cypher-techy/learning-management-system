import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/lib/env";
import { db, schema } from "../db";
import { AppError, conflict, forbidden, invalid, notFound } from "../errors";
import { getPaymentStatus, signSandboxBody, type CallbackRequest, type PaymentOutcome } from "../payments/providers";
import { assertCan, assertSignedIn, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { activateEnrollment, getEnrollment } from "./enrollment";
import { withNotifications } from "./notifications";

const { paymentTransactions, refunds, courses, enrollments, users } = schema;

export type Transaction = typeof paymentTransactions.$inferSelect;

export const checkoutSchema = z.object({ phone: z.string().trim().min(7).max(20) });

/**
 * Starts a payment for a paid course. This only ever creates a *pending*
 * transaction; access is granted later, by `settlePayment`, once the provider
 * has confirmed the money was received.
 */
export async function startCheckout(actor: Actor, courseId: string, input: z.infer<typeof checkoutSchema>) {
  assertSignedIn(actor);
  const status = getPaymentStatus();
  if (!status.enabled) throw new AppError("UNAVAILABLE", status.reason);
  const provider = status.provider;
  const data = checkoutSchema.parse(input);

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course || course.status !== "published") throw notFound("The course");
  if (course.priceCents <= 0) throw conflict("This course is free. Enroll directly.");
  if (!course.enrollmentOpen) throw conflict("Enrollment for this course is closed.");
  if (!provider.supportedCurrencies.includes(course.currency)) {
    throw new AppError("UNAVAILABLE", `${provider.label} cannot accept payments in ${course.currency}.`);
  }
  const enrollment = await getEnrollment(db, actor.id, courseId);
  if (enrollment?.status === "suspended") throw forbidden("Your enrollment in this course has been suspended.");
  if (enrollment && (enrollment.status === "active" || enrollment.status === "completed")) {
    throw conflict("You already have access to this course.");
  }

  // Reuse a very recent pending payment instead of prompting the phone twice.
  const [recent] = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.userId, actor.id),
        eq(paymentTransactions.courseId, courseId),
        eq(paymentTransactions.status, "pending"),
        eq(paymentTransactions.provider, provider.id),
        gt(paymentTransactions.createdAt, new Date(Date.now() - 90_000)),
      ),
    )
    .orderBy(desc(paymentTransactions.createdAt))
    .limit(1);
  if (recent) return { transaction: recent, instructions: "A payment request is already waiting on your phone." };

  const phone = provider.normalizePhone(data.phone);
  const transactionId = crypto.randomUUID();
  const started = await provider.initiate({
    transactionId,
    amountCents: course.priceCents,
    currency: course.currency,
    phone,
    description: course.title,
  });
  const [transaction] = await db
    .insert(paymentTransactions)
    .values({
      id: transactionId,
      userId: actor.id,
      courseId,
      provider: provider.id,
      providerReference: started.providerReference,
      amountCents: course.priceCents,
      currency: course.currency,
      payerPhone: phone,
    })
    .returning();
  return { transaction: transaction!, instructions: started.instructions };
}

export type SettleResult = "activated" | "failed" | "already_processed" | "unknown_reference" | "unconfirmed";

/**
 * Applies a provider-reported outcome exactly once.
 *
 * - The transaction row is locked, so concurrent or repeated callbacks are
 *   serialised and every one after the first is a no-op.
 * - The amount reported by the provider must cover the price.
 * - The status change and the enrollment activation commit together.
 */
export async function settlePayment(providerId: string, outcome: PaymentOutcome): Promise<SettleResult> {
  if (outcome.outcome === "pending") return "unconfirmed";
  return withNotifications(async (tx, notify) => {
    const [transaction] = await tx
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.provider, providerId),
          eq(paymentTransactions.providerReference, outcome.providerReference),
        ),
      )
      .for("update");
    if (!transaction) return "unknown_reference";
    if (transaction.status !== "pending") return "already_processed";

    const now = new Date();
    const underpaid = outcome.amountCents !== undefined && outcome.amountCents < transaction.amountCents;
    if (outcome.outcome === "failed" || underpaid) {
      await tx
        .update(paymentTransactions)
        .set({
          status: "failed",
          completedAt: now,
          failureReason: underpaid ? "The amount received was less than the course price." : (outcome.failureReason ?? "Payment failed."),
          receiptNumber: outcome.receiptNumber ?? null,
        })
        .where(eq(paymentTransactions.id, transaction.id));
      if (underpaid) {
        await logAudit(tx, {
          actorId: null,
          action: "payment.amount_mismatch",
          entityType: "payment_transaction",
          entityId: transaction.id,
          metadata: { expected: transaction.amountCents, received: outcome.amountCents },
        });
      }
      return "failed";
    }

    await tx
      .update(paymentTransactions)
      .set({ status: "succeeded", completedAt: now, receiptNumber: outcome.receiptNumber ?? null, failureReason: null })
      .where(eq(paymentTransactions.id, transaction.id));
    await activateEnrollment(tx, notify, {
      userId: transaction.userId,
      courseId: transaction.courseId,
      source: "purchase",
    });
    await logAudit(tx, {
      actorId: null,
      action: "payment.succeeded",
      entityType: "payment_transaction",
      entityId: transaction.id,
      metadata: { provider: providerId, receipt: outcome.receiptNumber ?? null },
    });
    return "activated";
  });
}

/**
 * Entry point for provider webhooks. Returns null when the request is not an
 * authentic callback for the configured provider.
 */
export async function handlePaymentCallback(providerId: string, request: CallbackRequest): Promise<SettleResult | null> {
  const status = getPaymentStatus();
  if (!status.enabled || status.provider.id !== providerId) return null;
  const provider = status.provider;
  const outcome = await provider.parseCallback(request);
  if (!outcome) return null;

  if (outcome.outcome === "succeeded" && provider.queryStatus) {
    // Never trust the callback alone: confirm with the provider directly.
    const confirmed = await provider.queryStatus(outcome.providerReference);
    if (confirmed.outcome !== "succeeded") {
      await logAudit(db, {
        actorId: null,
        action: "payment.callback_unconfirmed",
        entityType: "payment_transaction",
        metadata: { provider: providerId, reference: outcome.providerReference, confirmed: confirmed.outcome },
      });
      return confirmed.outcome === "failed" ? settlePayment(providerId, confirmed) : "unconfirmed";
    }
  }
  return settlePayment(providerId, outcome);
}

/** Lets a learner recover from a lost callback by asking the provider directly. */
export async function refreshPaymentStatus(actor: Actor, transactionId: string) {
  assertSignedIn(actor);
  const [transaction] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, transactionId));
  if (!transaction || transaction.userId !== actor.id) throw notFound("The payment");
  if (transaction.status !== "pending") return transaction.status;
  const status = getPaymentStatus();
  if (!status.enabled || status.provider.id !== transaction.provider || !status.provider.queryStatus) {
    return transaction.status;
  }
  const outcome = await status.provider.queryStatus(transaction.providerReference);
  await settlePayment(transaction.provider, outcome);
  const [fresh] = await db
    .select({ status: paymentTransactions.status })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, transactionId));
  return fresh!.status;
}

/**
 * Test control for the sandbox provider. It builds a signed callback and
 * sends it through the same verification path a real provider would use.
 */
export async function completeSandboxPayment(actor: Actor, transactionId: string, outcome: "succeeded" | "failed") {
  assertSignedIn(actor);
  const status = getPaymentStatus();
  if (!status.enabled || !status.provider.isSandbox) {
    throw forbidden("Sandbox payments are not available.");
  }
  const [transaction] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, transactionId));
  if (!transaction || transaction.userId !== actor.id) throw notFound("The payment");
  const rawBody = JSON.stringify({
    providerReference: transaction.providerReference,
    outcome,
    amountCents: transaction.amountCents,
    receiptNumber: outcome === "succeeded" ? `SBX${Date.now().toString(36).toUpperCase()}` : undefined,
    failureReason: outcome === "failed" ? "Declined in sandbox." : undefined,
  } satisfies PaymentOutcome);
  const headers = new Headers({ "x-sandbox-signature": signSandboxBody(rawBody, env().BETTER_AUTH_SECRET) });
  return handlePaymentCallback("sandbox", { token: "", headers, rawBody });
}

// --- Purchase history and refunds ------------------------------------------

export async function listMyPayments(actor: Actor) {
  assertSignedIn(actor);
  const rows = await db
    .select({ transaction: paymentTransactions, courseTitle: courses.title, courseSlug: courses.slug })
    .from(paymentTransactions)
    .innerJoin(courses, eq(courses.id, paymentTransactions.courseId))
    .where(eq(paymentTransactions.userId, actor.id))
    .orderBy(desc(paymentTransactions.createdAt));
  const ids = rows.map((r) => r.transaction.id);
  const refundRows = ids.length === 0 ? [] : await db.select().from(refunds).where(inArray(refunds.transactionId, ids));
  return rows.map((r) => ({ ...r, refunds: refundRows.filter((f) => f.transactionId === r.transaction.id) }));
}

export async function getMyPayment(actor: Actor, transactionId: string) {
  assertSignedIn(actor);
  const [row] = await db
    .select({ transaction: paymentTransactions, courseTitle: courses.title, courseSlug: courses.slug })
    .from(paymentTransactions)
    .innerJoin(courses, eq(courses.id, paymentTransactions.courseId))
    .where(eq(paymentTransactions.id, transactionId));
  if (!row || row.transaction.userId !== actor.id) throw notFound("The payment");
  return row;
}

export async function requestRefund(actor: Actor, transactionId: string, reason: string) {
  assertSignedIn(actor);
  if (reason.trim().length < 10) throw invalid("Tell us why you are asking for a refund (at least 10 characters).");
  await db.transaction(async (tx) => {
    const [transaction] = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, transactionId))
      .for("update");
    if (!transaction || transaction.userId !== actor.id) throw notFound("The payment");
    if (transaction.status !== "succeeded") throw conflict("Only completed payments can be refunded.");
    const [open] = await tx
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(eq(refunds.transactionId, transactionId), eq(refunds.status, "requested")));
    if (open) throw conflict("A refund request for this payment is already being reviewed.");
    await tx.insert(refunds).values({ transactionId, requestedBy: actor.id, reason: reason.trim().slice(0, 2000) });
  });
}

/**
 * Records the administrator's decision. Approving marks the transaction as
 * refunded and cancels access. The money itself must be returned through the
 * payment provider's own tools; this system does not move funds.
 */
export async function decideRefund(actor: Actor, refundId: string, decision: "approve" | "reject", note: string) {
  assertCan(actor, "payment.manage");
  await withNotifications(async (tx, notify) => {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
    if (!refund) throw notFound("The refund request");
    if (refund.status !== "requested") throw conflict("This refund request has already been decided.");
    const [transaction] = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, refund.transactionId))
      .for("update");
    const now = new Date();
    await tx
      .update(refunds)
      .set({
        status: decision === "approve" ? "approved" : "rejected",
        reviewedBy: actor.id,
        reviewedAt: now,
        reviewNote: note.trim() || null,
      })
      .where(eq(refunds.id, refundId));
    if (decision === "approve") {
      await tx.update(paymentTransactions).set({ status: "refunded" }).where(eq(paymentTransactions.id, transaction!.id));
      await tx
        .update(enrollments)
        .set({ status: "cancelled" })
        .where(and(eq(enrollments.userId, transaction!.userId), eq(enrollments.courseId, transaction!.courseId)));
    }
    await logAudit(tx, {
      actorId: actor.id,
      action: `refund.${decision}`,
      entityType: "refund",
      entityId: refundId,
      metadata: { transactionId: transaction!.id, note: note.trim() },
    });
    await notify({
      userIds: [refund.requestedBy],
      category: "enrollment",
      title: decision === "approve" ? "Your refund was approved" : "Your refund request was declined",
      body: note.trim() || undefined,
      link: "/learn/purchases",
    });
  });
}

export async function listRefundRequests(actor: Actor) {
  assertCan(actor, "payment.manage");
  return db
    .select({
      refund: refunds,
      transaction: paymentTransactions,
      courseTitle: courses.title,
      learnerName: users.name,
      learnerEmail: users.email,
    })
    .from(refunds)
    .innerJoin(paymentTransactions, eq(paymentTransactions.id, refunds.transactionId))
    .innerJoin(courses, eq(courses.id, paymentTransactions.courseId))
    .innerJoin(users, eq(users.id, refunds.requestedBy))
    .orderBy(desc(refunds.createdAt))
    .limit(200);
}

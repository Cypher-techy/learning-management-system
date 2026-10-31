import { getDB, persist, uid, now } from "@/lib/db";
import { parseStkCallback, callbackValue } from "@/lib/mpesa";
import { completePayment, failPayment } from "@/lib/payments";

/** Daraja STK callback. Idempotent: a callback for a CheckoutRequestID is
 *  processed at most once. Premium activation is also keyed by payment ID,
 *  so a late callback can safely add the receipt to a payment already
 *  confirmed through STK Query without granting a second subscription. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const cb = parseStkCallback(body);
  if (!cb) {
    console.warn("Elimu Bora: received a malformed Daraja callback.");
    return Response.json({ ResultCode: 1, ResultDesc: "Malformed callback" });
  }

  const db = await getDB();
  const payment = db.payments.find((p) => p.checkoutRequestId === cb.CheckoutRequestID);
  if (!payment) {
    console.warn(`Elimu Bora: Daraja callback for unknown CheckoutRequestID ${cb.CheckoutRequestID}.`);
    return Response.json({ ResultCode: 0, ResultDesc: "Unknown checkout — ignored" });
  }
  if (payment.callbackProcessed) return Response.json({ ResultCode: 0, ResultDesc: "Already processed" });

  payment.callbackProcessed = true;
  const resultCode = Number(cb.ResultCode);
  payment.resultCode = String(cb.ResultCode);

  if (resultCode === 0) {
    const amount = Number(callbackValue(cb, "Amount"));
    const receipt = String(callbackValue(cb, "MpesaReceiptNumber") || "");
    if (amount !== payment.amount || !receipt) {
      db.auditLogs.unshift({
        id: uid("al_"),
        actorId: "mpesa-callback",
        action: "payment.mismatch",
        target: payment.id,
        reason: `expected ${payment.amount} got ${amount}; receipt ${receipt || "missing"}`,
        createdAt: now(),
      });
      if (payment.status !== "completed") {
        failPayment(db, payment, {
          resultCode: payment.resultCode,
          resultDesc: "Callback amount/receipt mismatch — flagged for reconciliation.",
        });
      } else {
        payment.resultDesc = "Payment was confirmed by STK Query; its callback amount/receipt was flagged for reconciliation.";
      }
      await persist();
      return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    completePayment(db, payment, {
      receipt,
      resultCode: payment.resultCode,
      resultDesc: cb.ResultDesc || "Payment confirmed by Safaricom callback.",
      source: "callback",
    });
  } else if (payment.status === "completed") {
    db.auditLogs.unshift({
      id: uid("al_"),
      actorId: "mpesa-callback",
      action: "payment.callback_conflict",
      target: payment.id,
      reason: `Failure callback (${cb.ResultCode}: ${cb.ResultDesc}) arrived after STK Query confirmed payment.`,
      createdAt: now(),
    });
    console.warn(`Elimu Bora: conflicting failure callback ignored for completed payment ${payment.id}.`);
  } else {
    failPayment(db, payment, {
      resultCode: payment.resultCode,
      resultDesc: cb.ResultDesc || "M-Pesa payment did not complete.",
    });
  }

  await persist();
  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

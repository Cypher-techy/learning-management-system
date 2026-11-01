import { getDB, persist, now, type DB, type Payment } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { mpesaConfigured, stkQuery } from "@/lib/mpesa";
import { completePayment, failPayment } from "@/lib/payments";

const QUERY_AFTER_MS = 20 * 1000;
const QUERY_THROTTLE_MS = 10 * 1000;
const NO_CHECKOUT_TIMEOUT_MS = 2 * 60 * 1000;
const PENDING_TIMEOUT_MS = 10 * 60 * 1000;

async function reconcilePending(db: DB, payment: Payment) {
  if (payment.status !== "pending") return false;

  const createdAt = new Date(payment.createdAt).getTime();
  const ageMs = Number.isFinite(createdAt) ? Date.now() - createdAt : 0;
  let changed = false;

  if (!payment.checkoutRequestId) {
    if (ageMs >= NO_CHECKOUT_TIMEOUT_MS) {
      failPayment(db, payment, {
        resultDesc: "M-Pesa did not return a checkout reference for this attempt. Please start a new payment.",
      });
      return true;
    }
    return false;
  }

  const lastCheckAt = payment.lastStatusCheckAt ? new Date(payment.lastStatusCheckAt).getTime() : 0;
  const queryDue = ageMs >= QUERY_AFTER_MS && Date.now() - lastCheckAt >= QUERY_THROTTLE_MS;
  if (queryDue && mpesaConfigured()) {
    payment.lastStatusCheckAt = now();
    changed = true;
    try {
      const result = await stkQuery(payment.checkoutRequestId);
      if (result.resultCode) payment.resultCode = result.resultCode;
      if (result.merchantRequestId) payment.merchantRequestId = result.merchantRequestId;

      if (result.state === "completed") {
        // The CheckoutRequestID was created server-side for this exact
        // server-set amount, so a successful Daraja query is provider
        // confirmation even when the receipt-bearing callback was missed.
        completePayment(db, payment, {
          resultCode: result.resultCode,
          resultDesc: `${result.resultDesc} Confirmed by Daraja STK status query.`,
          source: "stk-query",
        });
      } else if (result.state === "failed") {
        failPayment(db, payment, {
          resultCode: result.resultCode,
          resultDesc: result.resultDesc,
        });
      } else {
        payment.resultDesc = result.resultDesc;
      }
    } catch (error) {
      console.error(`Elimu Bora: Daraja STK Query failed for payment ${payment.id}.`, error);
      payment.resultDesc = "Waiting for Safaricom confirmation.";
    }
  }

  if (payment.status === "pending" && ageMs >= PENDING_TIMEOUT_MS) {
    failPayment(db, payment, {
      resultDesc: "Payment confirmation timed out. If money was deducted, keep the M-Pesa receipt and contact support so the payment can be reconciled.",
    });
    changed = true;
  }

  return changed;
}

export async function GET(req: Request) {
  try {
    const user = await requireRole("student");
    const id = new URL(req.url).searchParams.get("id");
    const db = await getDB();
    const payment = db.payments.find((x) => x.id === id && x.studentId === user.id);
    if (!payment) throw new ApiError(404, "Payment not found.");

    if (await reconcilePending(db, payment)) await persist();
    return Response.json({ payment });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, uid, now, notify } from "@/lib/db";
import { parseStkCallback, callbackValue } from "@/lib/mpesa";

/** Daraja STK callback. Idempotent: a CheckoutRequestID is processed at most once.
 *  Premium is activated ONLY here, after amount + receipt validation. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const cb = parseStkCallback(body);
  if (!cb) return Response.json({ ResultCode: 1, ResultDesc: "Malformed callback" });
  const db = await getDB();
  const payment = db.payments.find(p => p.checkoutRequestId === cb.CheckoutRequestID);
  if (!payment) return Response.json({ ResultCode: 0, ResultDesc: "Unknown checkout — ignored" });
  if (payment.callbackProcessed) return Response.json({ ResultCode: 0, ResultDesc: "Already processed" });
  payment.callbackProcessed = true;
  payment.resultDesc = cb.ResultDesc;
  if (cb.ResultCode === 0) {
    const amount = Number(callbackValue(cb, "Amount"));
    const receipt = String(callbackValue(cb, "MpesaReceiptNumber") || "");
    if (amount !== payment.amount || !receipt) {
      payment.status = "failed"; payment.resultDesc = "Callback amount/receipt mismatch — flagged for reconciliation.";
      db.auditLogs.unshift({ id: uid("al_"), actorId: "mpesa-callback", action: "payment.mismatch", target: payment.id, reason: `expected ${payment.amount} got ${amount}`, createdAt: now() });
      await persist();
      return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }
    payment.status = "completed"; payment.completedAt = now(); payment.mpesaReceipt = receipt;
    const student = db.users.find(u => u.id === payment.studentId);
    if (student) {
      const plan = db.plans[0];
      const existing = db.subscriptions.find(s => s.id === student.subscriptionId && s.status === "active" && new Date(s.expiresAt).getTime() > Date.now());
      const start = existing ? new Date(existing.expiresAt) : new Date();
      const expires = new Date(start.getTime() + (plan?.intervalDays || 30) * 86400000);
      const sub = { id: uid("sub_"), studentId: student.id, plan: "premium" as const, status: "active" as const, startedAt: now(), expiresAt: expires.toISOString(), paymentId: payment.id };
      db.subscriptions.unshift(sub);
      student.plan = "premium"; student.subscriptionId = sub.id;
      notify(student.id, "Premium activated", `Payment ${receipt} confirmed. Elimu Bora Premium is active until ${expires.toLocaleDateString("en-KE")}.`, "/dashboard/student/subscription");
    }
  } else {
    payment.status = "failed";
    const student = db.users.find(u => u.id === payment.studentId);
    if (student) notify(student.id, "Payment not completed", cb.ResultDesc || "Your M-Pesa payment did not complete. No premium access was activated.");
  }
  await persist();
  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}

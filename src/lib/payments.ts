import { now, uid, notify, type DB, type Payment } from "@/lib/db";

export type PaymentConfirmationSource = "callback" | "stk-query";

function activatePremiumForPayment(db: DB, payment: Payment, receipt?: string) {
  const student = db.users.find((u) => u.id === payment.studentId);
  if (!student) return;

  const existingForPayment = db.subscriptions.find((s) => s.paymentId === payment.id);
  if (existingForPayment) {
    student.plan = "premium";
    student.subscriptionId = existingForPayment.id;
    return;
  }

  const plan = db.plans[0];
  const active = db.subscriptions
    .filter((s) => s.studentId === student.id && s.status === "active" && new Date(s.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
  const start = active ? new Date(active.expiresAt) : new Date();
  const expires = new Date(start.getTime() + (plan?.intervalDays || 30) * 86400000);
  const subscription = {
    id: uid("sub_"),
    studentId: student.id,
    plan: "premium" as const,
    status: "active" as const,
    startedAt: now(),
    expiresAt: expires.toISOString(),
    paymentId: payment.id,
  };
  db.subscriptions.unshift(subscription);
  student.plan = "premium";
  student.subscriptionId = subscription.id;

  const confirmation = receipt ? `Payment ${receipt} confirmed.` : "Safaricom confirmed your payment.";
  notify(
    student.id,
    "Premium activated",
    `${confirmation} Elimu Bora Premium is active until ${expires.toLocaleDateString("en-KE")}.`,
    "/dashboard/student/subscription",
  );
}

export function completePayment(
  db: DB,
  payment: Payment,
  options: { receipt?: string; resultCode?: string; resultDesc?: string; source: PaymentConfirmationSource },
) {
  payment.status = "completed";
  payment.completedAt ||= now();
  if (options.receipt) payment.mpesaReceipt = options.receipt;
  if (options.resultCode) payment.resultCode = options.resultCode;
  if (options.resultDesc) payment.resultDesc = options.resultDesc;
  payment.confirmationSource = options.source;
  activatePremiumForPayment(db, payment, options.receipt || payment.mpesaReceipt);
}

export function failPayment(
  db: DB,
  payment: Payment,
  options: { resultCode?: string; resultDesc: string; notifyUser?: boolean },
) {
  if (payment.status === "completed") return false;
  const wasFailed = payment.status === "failed";
  payment.status = "failed";
  if (options.resultCode) payment.resultCode = options.resultCode;
  payment.resultDesc = options.resultDesc;

  if (!wasFailed && options.notifyUser !== false) {
    const student = db.users.find((u) => u.id === payment.studentId);
    if (student) {
      notify(
        student.id,
        "Payment not completed",
        options.resultDesc || "Your M-Pesa payment did not complete. No premium access was activated.",
        "/dashboard/student/subscription",
      );
    }
  }
  return true;
}

import { audit, now, uid, notify, type DB, type Payment } from "@/lib/db";

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

  const billingInterval = payment.billingInterval || "monthly";
  const purchasedPlan = payment.planId
    ? db.plans.find((plan) => plan.id === payment.planId)
    : db.plans.find((plan) => plan.billingInterval === billingInterval);
  const intervalDays = payment.intervalDays || purchasedPlan?.intervalDays || (billingInterval === "annual" ? 365 : 30);
  const active = db.subscriptions
    .filter((s) => s.studentId === student.id && s.status === "active" && new Date(s.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0];
  const start = active ? new Date(active.expiresAt) : new Date();
  const expires = new Date(start.getTime() + intervalDays * 86400000);
  const subscription = {
    id: uid("sub_"),
    studentId: student.id,
    plan: "premium" as const,
    status: "active" as const,
    startedAt: now(),
    expiresAt: expires.toISOString(),
    paymentId: payment.id,
    planId: payment.planId || purchasedPlan?.id,
    billingInterval,
    intervalDays,
  };
  db.subscriptions.unshift(subscription);
  student.plan = "premium";
  student.subscriptionId = subscription.id;

  const confirmation = receipt ? `Payment ${receipt} confirmed.` : "Safaricom confirmed your payment.";
  notify(
    student.id,
    "Premium activated",
    `${confirmation} Your existing all-access Premium term is active until ${expires.toLocaleDateString("en-KE")}.`,
    "/dashboard/student/purchases",
  );
}

function ensureCourseEnrollment(db: DB, studentId: string, courseId: string) {
  let enrollment = db.enrollments.find((e) => e.studentId === studentId && e.courseId === courseId);
  if (!enrollment) {
    enrollment = {
      id: uid("e_"),
      studentId,
      courseId,
      enrolledAt: now(),
      completedLessons: [],
      saved: false,
      activeMin: 0,
    };
    db.enrollments.push(enrollment);
  }
  return enrollment;
}

function creditCourseSale(db: DB, payment: Payment, courseTitle: string, tutorId: string) {
  if (db.walletTxs.some((t) => t.paymentId === payment.id && t.type === "earning")) return 0;
  const tutorPercent = Math.max(0, Math.min(100, Number(db.settings.tutorPercent) || 0));
  const amount = Math.round(payment.amount * (tutorPercent / 100));
  if (amount <= 0) return 0;
  db.walletTxs.unshift({
    id: uid("w_"),
    tutorId,
    type: "earning",
    amount,
    note: `Course sale — ${courseTitle} (${tutorPercent}% tutor share)`,
    createdAt: now(),
    paymentId: payment.id,
    courseId: payment.courseId,
  });
  return amount;
}

function grantCoursePurchase(db: DB, payment: Payment, receipt?: string) {
  const student = db.users.find((u) => u.id === payment.studentId);
  const course = payment.courseId ? db.courses.find((c) => c.id === payment.courseId) : undefined;
  if (!student || !course) return;

  if (!Array.isArray(db.coursePurchases)) db.coursePurchases = [];
  const existingForPayment = db.coursePurchases.find((p) => p.paymentId === payment.id);
  const existingEntitlement = db.coursePurchases.find(
    (p) => p.studentId === student.id && p.courseId === course.id && p.status === "active",
  );

  ensureCourseEnrollment(db, student.id, course.id);

  if (existingForPayment || existingEntitlement) {
    // A callback and STK Query can both confirm the same checkout. The
    // entitlement, enrolment and tutor earning must be granted once.
    if (existingForPayment) {
      creditCourseSale(db, payment, course.title, course.tutorId);
    } else if (existingEntitlement) {
      // A distinct checkout was somehow paid after entitlement already
      // existed (for example, prompts created before this safeguard). Do not
      // create a second entitlement or tutor credit from it; flag the money
      // for reconciliation/refund review instead of silently absorbing it.
      audit(
        student.id,
        "payment.duplicate_course_purchase",
        course.id,
        `payment ${payment.id}; existing purchase ${existingEntitlement.id}; flagged for reconciliation/refund review`,
      );
      payment.resultDesc = `${payment.resultDesc || "Payment confirmed by Safaricom."} Duplicate payment for an already-owned course — flagged for reconciliation/refund review.`;
      notify(
        student.id,
        "Duplicate course payment flagged",
        `A payment for "${course.title}" was confirmed after you already owned the course. It has been flagged for reconciliation; please keep the M-Pesa receipt and contact support if money was deducted twice.`,
        "/dashboard/student/purchases",
      );
    }
    return;
  }

  const purchase = {
    id: uid("purchase_"),
    studentId: student.id,
    courseId: course.id,
    paymentId: payment.id,
    priceKES: payment.amount,
    purchasedAt: payment.completedAt || now(),
    access: "lifetime" as const,
    status: "active" as const,
  };
  db.coursePurchases.unshift(purchase);
  const tutorEarning = creditCourseSale(db, payment, course.title, course.tutorId);
  audit(student.id, "course.purchased", course.id, `payment ${payment.id}; KSh ${payment.amount}`);

  const confirmation = receipt ? `Payment ${receipt} confirmed.` : "Safaricom confirmed your payment.";
  notify(
    student.id,
    "Course purchased",
    `${confirmation} You now have lifetime access to "${course.title}".`,
    `/courses/${course.id}/learn`,
  );
  notify(
    course.tutorId,
    "New course sale",
    `${student.fullName} purchased "${course.title}" for KSh ${payment.amount.toLocaleString("en-KE")}. Your credited share is KSh ${tutorEarning.toLocaleString("en-KE")}.`,
    "/dashboard/tutor/earnings",
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

  if (payment.kind === "course_purchase" || payment.courseId) {
    grantCoursePurchase(db, payment, options.receipt || payment.mpesaReceipt);
  } else {
    // Legacy branch: subscriptions already sold under the former
    // all-access model, including any checkout that was already pending
    // when per-course pricing launched, still receive their paid term.
    activatePremiumForPayment(db, payment, options.receipt || payment.mpesaReceipt);
  }
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
        options.resultDesc || (payment.kind === "course_purchase"
          ? "Your M-Pesa payment did not complete. No course access was activated."
          : "Your M-Pesa payment did not complete. No premium access was activated."),
        "/dashboard/student/purchases",
      );
    }
  }
  return true;
}

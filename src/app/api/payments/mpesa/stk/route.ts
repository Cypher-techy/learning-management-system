import { canAccessCourse, getDB, isValidCoursePriceKES, persist, uid, now, type Payment } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { mpesaConfigurationError, mpesaRouting, stkPush, normalisePhone } from "@/lib/mpesa";
import { quoteCourse } from "@/lib/fx";

const RESUME_PENDING_MS = 2 * 60 * 1000;
const RESUME_COURSE_PENDING_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const db = await getDB();
    const body = await req.json().catch(() => ({}));
    const phone = body?.phone;
    const courseId = String(body?.courseId || "");
    if (!courseId) {
      throw new ApiError(400, "Choose the premium course you want to buy. Monthly and annual all-access subscriptions are no longer sold; each premium course is purchased independently.");
    }

    const course = db.courses.find((c) => c.id === courseId || c.slug === courseId);
    if (!course || course.status !== "published") throw new ApiError(404, "Course not found.");
    if (course.access !== "premium") throw new ApiError(400, "This is a free course — enrol without payment.");
    if (!isValidCoursePriceKES(course.priceKES)) throw new ApiError(503, "This course's price has not been configured for sale yet. No payment has been started.");
    if (canAccessCourse(db, user, course)) {
      return Response.json({
        error: "You already have access to this course, so no payment was started.",
        alreadyAccessible: true,
        courseId: course.id,
      }, { status: 409 });
    }

    const msisdn = normalisePhone(String(phone || user.phone || ""));
    if (!/^254[17]\d{8}$/.test(msisdn)) throw new ApiError(400, "Enter a valid Kenyan M-Pesa number (e.g. 0712 345 678).");

    // Avoid stacking a second prompt on top of one Safaricom is still
    // processing; the status endpoint will reconcile the original checkout.
    // For the same student/course, resume for the full reconciliation window
    // even if the learner re-enters a different phone number: two live prompts
    // must never become two charges for one lifetime entitlement.
    const pendingAge = (p: Payment) => Date.now() - new Date(p.createdAt).getTime();
    const existingCoursePending = db.payments.find((p) =>
      p.studentId === user.id && p.courseId === course.id && p.status === "pending" &&
      !!p.checkoutRequestId && pendingAge(p) < RESUME_COURSE_PENDING_MS,
    );
    const existingPhonePending = db.payments.find((p) =>
      p.studentId === user.id && p.status === "pending" && p.phone === `+${msisdn}` &&
      !!p.checkoutRequestId && pendingAge(p) < RESUME_PENDING_MS,
    );
    const existingPending = existingCoursePending || existingPhonePending;
    if (existingPending) {
      return Response.json({
        ok: true,
        resumed: true,
        paymentId: existingPending.id,
        kind: existingPending.kind || (existingPending.courseId ? "course_purchase" : "subscription"),
        courseId: existingPending.courseId,
        courseTitle: existingPending.courseTitle,
        amountKES: existingPending.amount,
        displayAmountUSD: existingPending.displayAmountUSD,
        billingInterval: existingPending.billingInterval,
        intervalDays: existingPending.intervalDays,
        exchangeRateUSDKES: existingPending.exchangeRateUSDKES,
        exchangeRateDate: existingPending.exchangeRateDate,
        message: "A payment prompt is already in progress for this number. Complete it on your phone, or use Check status on this page.",
      });
    }

    // The course price stored on the server is canonical in whole KES and
    // is the only amount Daraja may charge. The latest FX rate is fetched
    // solely to show and audit the USD display equivalent. Any amount,
    // price or interval supplied by the browser is ignored.
    let quote;
    try {
      quote = await quoteCourse(course);
    } catch (error) {
      console.error("Elimu Bora: live USD/KES quote failed before course STK Push.", error);
      throw new ApiError(503, "The live USD/KES exchange rate is temporarily unavailable. Please try again shortly; no payment has been started.");
    }

    const payment: Payment = {
      id: uid("pay_"),
      kind: "course_purchase",
      courseId: course.id,
      courseTitle: course.title,
      coursePriceKES: quote.coursePriceKES,
      studentId: user.id,
      amount: quote.amountKES,
      currency: "KES" as const,
      provider: "mpesa" as const,
      status: "pending" as const,
      phone: `+${msisdn}`,
      displayCurrency: "USD",
      displayAmountUSD: quote.displayAmountUSD,
      exchangeRateUSDKES: quote.exchangeRateUSDKES,
      exchangeRateDate: quote.exchangeRateDate,
      exchangeRateSource: quote.exchangeRateSource,
      quotedAt: quote.quotedAt,
      createdAt: now(),
    };
    db.payments.unshift(payment);
    await persist();

    const configurationError = mpesaConfigurationError();
    if (configurationError) {
      payment.status = "failed";
      payment.resultDesc = configurationError;
      await persist();
      console.error("Elimu Bora: M-Pesa is not configured correctly.", configurationError);
      return Response.json({
        error: "M-Pesa payments are not configured correctly on this deployment. Set the MPESA_* server environment variables (see .env.example), redeploy, then try again.",
        configured: false,
        paymentId: payment.id,
        kind: payment.kind,
        courseId: payment.courseId,
        courseTitle: payment.courseTitle,
        amountKES: payment.amount,
        displayAmountUSD: payment.displayAmountUSD,
        exchangeRateUSDKES: payment.exchangeRateUSDKES,
        exchangeRateDate: payment.exchangeRateDate,
      }, { status: 503 });
    }

    const routing = mpesaRouting();
    payment.businessShortCode = routing.businessShortCode;
    payment.partyB = routing.partyB;

    try {
      const result = await stkPush(msisdn, payment.amount, "Elimu Course");
      payment.checkoutRequestId = result.checkoutRequestId;
      payment.merchantRequestId = result.merchantRequestId;
      payment.businessShortCode = result.businessShortCode;
      payment.partyB = result.partyB;
      payment.resultDesc = "STK Push sent. Waiting for Safaricom confirmation.";
      await persist();
      return Response.json({
        ok: true,
        paymentId: payment.id,
        kind: payment.kind,
        courseId: payment.courseId,
        courseTitle: payment.courseTitle,
        amountKES: payment.amount,
        displayAmountUSD: payment.displayAmountUSD,
        exchangeRateUSDKES: payment.exchangeRateUSDKES,
        exchangeRateDate: payment.exchangeRateDate,
        message: `Check your phone and enter your M-Pesa PIN to pay KSh ${payment.amount.toLocaleString("en-KE")} for "${course.title}". Lifetime access activates only once Safaricom confirms.`,
      });
    } catch (err) {
      payment.status = "failed";
      payment.resultDesc = err instanceof Error ? err.message : "STK Push failed";
      await persist();
      console.error("Elimu Bora: Daraja STK Push failed.", err);
      throw new ApiError(502, "We could not start the M-Pesa prompt. Please try again shortly; check this page before making another payment attempt.");
    }
  } catch (e) { return jsonError(e); }
}

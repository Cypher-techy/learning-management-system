import { getDB, persist, uid, now, type Payment } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { mpesaConfigurationError, mpesaRouting, stkPush, normalisePhone } from "@/lib/mpesa";
import { quoteSubscription } from "@/lib/fx";
import { isBillingInterval } from "@/lib/pricing";

const RESUME_PENDING_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const db = await getDB();
    const body = await req.json();
    const phone = body?.phone;
    const requestedInterval = body?.interval ?? body?.billingInterval ?? body?.plan ?? "monthly";
    if (!isBillingInterval(requestedInterval)) throw new ApiError(400, "Choose a monthly or annual Premium plan.");

    const msisdn = normalisePhone(String(phone || user.phone || ""));
    if (!/^254[17]\d{8}$/.test(msisdn)) throw new ApiError(400, "Enter a valid Kenyan M-Pesa number (e.g. 0712 345 678).");

    // Avoid stacking a second prompt on top of one Safaricom is still
    // processing; the status endpoint will reconcile the original checkout.
    // The original server-quoted KES amount and plan term remain authoritative.
    const existingPending = db.payments.find((p) =>
      p.studentId === user.id && p.status === "pending" && p.phone === `+${msisdn}` &&
      !!p.checkoutRequestId && Date.now() - new Date(p.createdAt).getTime() < RESUME_PENDING_MS,
    );
    if (existingPending) {
      return Response.json({
        ok: true,
        resumed: true,
        paymentId: existingPending.id,
        amountKES: existingPending.amount,
        displayAmountUSD: existingPending.displayAmountUSD,
        billingInterval: existingPending.billingInterval || "monthly",
        intervalDays: existingPending.intervalDays || 30,
        exchangeRateUSDKES: existingPending.exchangeRateUSDKES,
        exchangeRateDate: existingPending.exchangeRateDate,
        message: "A payment prompt is already in progress for this number. Complete it on your phone, or use Check status on this page.",
      });
    }

    // Display prices are configured in USD. At transaction time the server
    // fetches the latest USD/KES reference rate and derives the only KES
    // amount Daraja is asked to charge. Browser-supplied amounts are ignored.
    let quote;
    try {
      quote = await quoteSubscription(db.settings, requestedInterval);
    } catch (error) {
      console.error("Elimu Bora: live USD/KES quote failed before STK Push.", error);
      throw new ApiError(503, "The live USD/KES exchange rate is temporarily unavailable. Please try again shortly; no payment has been started.");
    }

    const amount = quote.amountKES;
    const payment: Payment = {
      id: uid("pay_"),
      studentId: user.id,
      amount,
      currency: "KES" as const,
      provider: "mpesa" as const,
      status: "pending" as const,
      phone: `+${msisdn}`,
      planId: quote.id,
      billingInterval: quote.billingInterval,
      intervalDays: quote.intervalDays,
      displayCurrency: "USD",
      displayAmountUSD: quote.priceUSD,
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
        amountKES: payment.amount,
        displayAmountUSD: payment.displayAmountUSD,
        billingInterval: payment.billingInterval,
        intervalDays: payment.intervalDays,
        exchangeRateUSDKES: payment.exchangeRateUSDKES,
        exchangeRateDate: payment.exchangeRateDate,
      }, { status: 503 });
    }

    const routing = mpesaRouting();
    payment.businessShortCode = routing.businessShortCode;
    payment.partyB = routing.partyB;

    try {
      const result = await stkPush(msisdn, amount, "Elimu Bora");
      payment.checkoutRequestId = result.checkoutRequestId;
      payment.merchantRequestId = result.merchantRequestId;
      payment.businessShortCode = result.businessShortCode;
      payment.partyB = result.partyB;
      payment.resultDesc = "STK Push sent. Waiting for Safaricom confirmation.";
      await persist();
      return Response.json({
        ok: true,
        paymentId: payment.id,
        amountKES: payment.amount,
        displayAmountUSD: payment.displayAmountUSD,
        billingInterval: payment.billingInterval,
        intervalDays: payment.intervalDays,
        exchangeRateUSDKES: payment.exchangeRateUSDKES,
        exchangeRateDate: payment.exchangeRateDate,
        message: `Check your phone and enter your M-Pesa PIN to pay KSh ${payment.amount.toLocaleString("en-KE")}. Premium activates automatically once Safaricom confirms.`,
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

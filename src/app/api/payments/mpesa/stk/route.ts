import { getDB, persist, uid, now, type Payment } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { mpesaConfigurationError, mpesaRouting, stkPush, normalisePhone } from "@/lib/mpesa";

const RESUME_PENDING_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const db = await getDB();
    const { phone } = await req.json();
    const msisdn = normalisePhone(String(phone || user.phone || ""));
    if (!/^254[17]\d{8}$/.test(msisdn)) throw new ApiError(400, "Enter a valid Kenyan M-Pesa number (e.g. 0712 345 678).");

    // Avoid stacking a second prompt on top of one Safaricom is still
    // processing; the status endpoint will reconcile the original checkout.
    const existingPending = db.payments.find((p) =>
      p.studentId === user.id && p.status === "pending" && p.phone === `+${msisdn}` &&
      !!p.checkoutRequestId && Date.now() - new Date(p.createdAt).getTime() < RESUME_PENDING_MS,
    );
    if (existingPending) {
      return Response.json({
        ok: true,
        resumed: true,
        paymentId: existingPending.id,
        message: "A payment prompt is already in progress for this number. Complete it on your phone, or use Check status on this page.",
      });
    }

    // Amount ALWAYS comes from server-side settings — never from the browser.
    const amount = db.settings.premiumPriceKES;
    const payment: Payment = {
      id: uid("pay_"),
      studentId: user.id,
      amount,
      currency: "KES" as const,
      provider: "mpesa" as const,
      status: "pending" as const,
      phone: `+${msisdn}`,
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
        message: "Check your phone and enter your M-Pesa PIN to complete payment. Premium activates automatically once Safaricom confirms.",
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

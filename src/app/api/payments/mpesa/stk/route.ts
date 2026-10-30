import { getDB, persist, uid, now, type Payment } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { mpesaConfigured, stkPush, normalisePhone } from "@/lib/mpesa";

export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const db = getDB();
    const { phone } = await req.json();
    const msisdn = normalisePhone(String(phone || user.phone || ""));
    if (!/^254[17]\d{8}$/.test(msisdn)) throw new ApiError(400, "Enter a valid Kenyan M-Pesa number (e.g. 0712 345 678).");
    // Amount ALWAYS comes from server-side settings — never from the browser.
    const amount = db.settings.premiumPriceKES;
    const payment: Payment = { id: uid("pay_"), studentId: user.id, amount, currency: "KES" as const, provider: "mpesa" as const, status: "pending" as const, phone: "+" + msisdn, createdAt: now() };
    db.payments.unshift(payment); persist();
    if (!mpesaConfigured()) {
      payment.status = "failed"; payment.resultDesc = "M-Pesa Daraja credentials are not configured on this deployment.";
      persist();
      return Response.json({
        error: "M-Pesa payments are not configured yet. Set the MPESA_* server environment variables (see .env.example), then try again.",
        configured: false, paymentId: payment.id,
      }, { status: 503 });
    }
    try {
      const { checkoutRequestId, merchantRequestId } = await stkPush(msisdn, amount, "EDVORA");
      payment.checkoutRequestId = checkoutRequestId; payment.merchantRequestId = merchantRequestId; persist();
      return Response.json({ ok: true, paymentId: payment.id, message: "Check your phone and enter your M-Pesa PIN to complete payment. Premium activates automatically once Safaricom confirms." });
    } catch (err) {
      payment.status = "failed"; payment.resultDesc = err instanceof Error ? err.message : "STK Push failed"; persist();
      throw new ApiError(502, "We could not reach M-Pesa. No charge was made — please try again.");
    }
  } catch (e) { return jsonError(e); }
}

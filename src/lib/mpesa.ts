/**
 * Safaricom Daraja (M-Pesa Express / STK Push) integration.
 * Credentials are read exclusively from server-side environment variables.
 * Premium is ONLY activated by the verified callback handler — never on initiation.
 */
export function mpesaConfigured() {
  return !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE && process.env.MPESA_PASSKEY && process.env.MPESA_CALLBACK_URL);
}
function baseUrl() {
  return process.env.MPESA_ENVIRONMENT === "production"
    ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}
export function normalisePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  return digits;
}
async function accessToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }, cache: "no-store",
  });
  if (!res.ok) throw new Error("Daraja OAuth failed");
  const data = await res.json();
  return data.access_token as string;
}
export async function stkPush(phone: string, amount: number, accountRef: string) {
  const token = await accessToken();
  const ts = new Date();
  const timestamp = ts.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const shortcode = process.env.MPESA_SHORTCODE!;
  const password = Buffer.from(shortcode + process.env.MPESA_PASSKEY! + timestamp).toString("base64");
  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
      Amount: amount, PartyA: normalisePhone(phone), PartyB: shortcode,
      PhoneNumber: normalisePhone(phone), CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountRef.slice(0, 12), TransactionDesc: "EDVORA Premium subscription",
    }),
  });
  const data = await res.json();
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.errorMessage || data.ResponseDescription || "STK Push was rejected by Daraja.");
  }
  return { checkoutRequestId: data.CheckoutRequestID as string, merchantRequestId: data.MerchantRequestID as string };
}
export interface StkCallback {
  CheckoutRequestID: string; ResultCode: number; ResultDesc: string;
  CallbackMetadata?: { Item: { Name: string; Value?: string | number }[] };
}
export function parseStkCallback(body: unknown): StkCallback | null {
  try {
    const cb = (body as { Body?: { stkCallback?: StkCallback } })?.Body?.stkCallback;
    return cb ?? null;
  } catch { return null; }
}
export function callbackValue(cb: StkCallback, name: string) {
  return cb.CallbackMetadata?.Item.find((i) => i.Name === name)?.Value;
}

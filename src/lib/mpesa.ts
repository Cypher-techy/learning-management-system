/**
 * Safaricom Daraja (M-Pesa Express / STK Push) integration.
 * Credentials are read exclusively from server-side environment variables.
 * Premium is only activated after a verified callback or STK Query result.
 *
 * Routing differs by merchant type:
 * - Paybill: BusinessShortCode and PartyB are both the Paybill number.
 * - Till/Buy Goods: BusinessShortCode is the Store/Head Office (H.O.)
 *   number issued for the Daraja go-live, while PartyB is the actual Till
 *   number. Forcing PartyB to the H.O. number can produce Safaricom's
 *   “The Agent number and Store number entered do not match” failure.
 */
export type MpesaTransactionType = "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";

const TRANSACTION_TYPES = new Set<MpesaTransactionType>([
  "CustomerPayBillOnline",
  "CustomerBuyGoodsOnline",
]);
const DARAJA_TIMEOUT_MS = 15_000;

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function mpesaTransactionType(): MpesaTransactionType {
  const raw = env("MPESA_TRANSACTION_TYPE") || "CustomerPayBillOnline";
  return raw === "CustomerBuyGoodsOnline" ? raw : "CustomerPayBillOnline";
}

export function mpesaRouting() {
  const businessShortCode = env("MPESA_SHORTCODE");
  const transactionType = mpesaTransactionType();
  const tillNumber = env("MPESA_TILL_NUMBER") || env("MPESA_PARTY_B");
  return {
    businessShortCode,
    transactionType,
    tillNumber,
    partyB: transactionType === "CustomerBuyGoodsOnline"
      ? tillNumber || businessShortCode
      : businessShortCode,
  };
}

export function mpesaConfigurationError(): string | null {
  const missing = ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_URL"]
    .filter((name) => !env(name));
  if (missing.length) return `Missing M-Pesa environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`;

  const environment = env("MPESA_ENVIRONMENT") || "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    return "MPESA_ENVIRONMENT must be exactly “sandbox” or “production”.";
  }

  const rawTransactionType = env("MPESA_TRANSACTION_TYPE") || "CustomerPayBillOnline";
  if (!TRANSACTION_TYPES.has(rawTransactionType as MpesaTransactionType)) {
    return "MPESA_TRANSACTION_TYPE must be CustomerPayBillOnline for a Paybill or CustomerBuyGoodsOnline for a Till.";
  }

  const { businessShortCode, tillNumber } = mpesaRouting();
  if (env("MPESA_TILL_NUMBER") && env("MPESA_PARTY_B") && env("MPESA_TILL_NUMBER") !== env("MPESA_PARTY_B")) {
    return "MPESA_TILL_NUMBER and MPESA_PARTY_B contain different Till numbers. Keep only MPESA_TILL_NUMBER so PartyB is unambiguous.";
  }
  if (!/^\d+$/.test(businessShortCode)) {
    return "MPESA_SHORTCODE must contain digits only. For a Till, use the Store/Head Office number issued for the Daraja go-live—not a phone number.";
  }

  if (rawTransactionType === "CustomerBuyGoodsOnline") {
    if (!tillNumber) {
      return "MPESA_TILL_NUMBER is required for CustomerBuyGoodsOnline. Set MPESA_SHORTCODE to the Store/Head Office (H.O.) number and MPESA_TILL_NUMBER to the actual Till number sent as PartyB.";
    }
    if (!/^\d+$/.test(tillNumber)) return "MPESA_TILL_NUMBER must contain digits only.";
  } else {
    const explicitPartyB = env("MPESA_PARTY_B");
    if (explicitPartyB && explicitPartyB !== businessShortCode) {
      return "For CustomerPayBillOnline, PartyB must be the same Paybill number as MPESA_SHORTCODE. Remove MPESA_PARTY_B or use the Till settings.";
    }
    if (tillNumber && tillNumber !== businessShortCode) {
      return "A Till number is configured while MPESA_TRANSACTION_TYPE is CustomerPayBillOnline. For a Till, set MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline; for a Paybill, remove MPESA_TILL_NUMBER/MPESA_PARTY_B.";
    }
  }

  try {
    const callback = new URL(env("MPESA_CALLBACK_URL"));
    if (callback.protocol !== "https:" || callback.hostname === "localhost" || callback.hostname === "127.0.0.1") {
      return "MPESA_CALLBACK_URL must be a public HTTPS URL that Safaricom can reach.";
    }
    if (!callback.pathname.endsWith("/api/payments/mpesa/callback")) {
      return "MPESA_CALLBACK_URL must end with /api/payments/mpesa/callback.";
    }
  } catch {
    return "MPESA_CALLBACK_URL is not a valid URL.";
  }

  return null;
}

export function mpesaConfigured() {
  return mpesaConfigurationError() === null;
}

function baseUrl() {
  return env("MPESA_ENVIRONMENT") === "production"
    ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

export function normalisePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  return digits;
}

function darajaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
  const hour = value.hour === "24" ? "00" : value.hour;
  return `${value.year}${value.month}${value.day}${hour}${value.minute}${value.second}`;
}

function darajaPassword(businessShortCode: string, timestamp: string) {
  return Buffer.from(businessShortCode + env("MPESA_PASSKEY") + timestamp).toString("base64");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DARAJA_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Daraja did not respond in time. Please try again shortly.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

let tokenCache: { scope: string; token: string; expiresAt: number } | null = null;

async function accessToken() {
  const scope = `${baseUrl()}|${env("MPESA_CONSUMER_KEY")}`;
  if (tokenCache?.scope === scope && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const auth = Buffer.from(`${env("MPESA_CONSUMER_KEY")}:${env("MPESA_CONSUMER_SECRET")}`).toString("base64");
  const res = await fetchWithTimeout(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  const data = await readJson(res);
  if (!res.ok || !data.access_token) {
    throw new Error(data.errorMessage || data.error_description || "Daraja OAuth failed. Check the consumer key, secret and environment.");
  }
  const expiresIn = Number(data.expires_in || 3599);
  tokenCache = {
    scope,
    token: String(data.access_token),
    expiresAt: Date.now() + Math.max(120, expiresIn - 180) * 1000,
  };
  return tokenCache.token;
}

function assertConfigured() {
  const error = mpesaConfigurationError();
  if (error) throw new Error(error);
}

export async function stkPush(phone: string, amount: number, accountRef: string) {
  assertConfigured();
  const token = await accessToken();
  const timestamp = darajaTimestamp();
  const { businessShortCode, partyB, transactionType } = mpesaRouting();
  const password = darajaPassword(businessShortCode, timestamp);
  const msisdn = normalisePhone(phone);
  const res = await fetchWithTimeout(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: transactionType,
      Amount: amount,
      PartyA: msisdn,
      PartyB: partyB,
      PhoneNumber: msisdn,
      CallBackURL: env("MPESA_CALLBACK_URL"),
      AccountReference: accountRef.slice(0, 12),
      TransactionDesc: "Elimu Premium",
    }),
  });
  const data = await readJson(res);
  if (!res.ok || String(data.ResponseCode) !== "0") {
    throw new Error(data.errorMessage || data.ResponseDescription || data.CustomerMessage || "STK Push was rejected by Daraja.");
  }
  if (!data.CheckoutRequestID) throw new Error("Daraja accepted the request but did not return a CheckoutRequestID.");
  return {
    checkoutRequestId: String(data.CheckoutRequestID),
    merchantRequestId: String(data.MerchantRequestID || ""),
    businessShortCode,
    partyB,
    transactionType,
  };
}

export interface StkQueryResult {
  state: "completed" | "failed" | "processing";
  resultCode?: string;
  resultDesc: string;
  checkoutRequestId?: string;
  merchantRequestId?: string;
}

export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
  assertConfigured();
  const token = await accessToken();
  const timestamp = darajaTimestamp();
  const { businessShortCode } = mpesaRouting();
  const res = await fetchWithTimeout(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: businessShortCode,
      Password: darajaPassword(businessShortCode, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const data = await readJson(res);

  if (data.CheckoutRequestID && String(data.CheckoutRequestID) !== checkoutRequestId) {
    return { state: "processing", resultDesc: "Safaricom returned a status for a different checkout; waiting for a matching confirmation." };
  }

  const processingMessage = String(data.errorMessage || data.ResultDesc || "").toLowerCase();
  if (String(data.errorCode || data.ResultCode || "") === "500.001.1001" || processingMessage.includes("being processed")) {
    return { state: "processing", resultCode: "500.001.1001", resultDesc: "The transaction is being processed" };
  }

  const hasResult = data.ResultCode !== undefined && data.ResultCode !== null && data.ResultCode !== "";
  const accepted = data.ResponseCode === undefined || String(data.ResponseCode) === "0";
  if (hasResult && accepted) {
    const resultCode = String(data.ResultCode);
    return {
      state: resultCode === "0" ? "completed" : "failed",
      resultCode,
      resultDesc: String(data.ResultDesc || (resultCode === "0" ? "Payment confirmed by Safaricom." : "M-Pesa payment did not complete.")),
      checkoutRequestId: data.CheckoutRequestID ? String(data.CheckoutRequestID) : checkoutRequestId,
      merchantRequestId: data.MerchantRequestID ? String(data.MerchantRequestID) : undefined,
    };
  }

  return {
    state: "processing",
    resultCode: data.errorCode ? String(data.errorCode) : undefined,
    resultDesc: String(data.errorMessage || data.ResponseDescription || "Safaricom has not returned a final payment result yet."),
  };
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

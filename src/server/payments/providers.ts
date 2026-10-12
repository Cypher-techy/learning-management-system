import { createHmac, timingSafeEqual } from "node:crypto";
import { env, isProductionRuntime } from "@/lib/env";
import { AppError, invalid } from "../errors";

export type PaymentOutcome = {
  providerReference: string;
  outcome: "succeeded" | "failed" | "pending";
  receiptNumber?: string;
  /** Amount the provider says was paid, in minor units, when it reports one. */
  amountCents?: number;
  failureReason?: string;
};

export type InitiateInput = {
  transactionId: string;
  amountCents: number;
  currency: string;
  phone: string;
  description: string;
};

export type CallbackRequest = {
  /** Secret path segment from the callback URL. */
  token: string;
  headers: Headers;
  rawBody: string;
};

export interface PaymentProvider {
  readonly id: "mpesa" | "sandbox";
  readonly label: string;
  /** True for the non-production test provider. Surfaced prominently in the UI. */
  readonly isSandbox: boolean;
  readonly supportedCurrencies: string[];
  normalizePhone(phone: string): string;
  initiate(input: InitiateInput): Promise<{ providerReference: string; instructions: string }>;
  /** Authenticates and parses a callback. Returns null when it is not authentic. */
  parseCallback(request: CallbackRequest): Promise<PaymentOutcome | null>;
  /** Server-to-server confirmation, where the provider offers one. */
  queryStatus?(providerReference: string): Promise<PaymentOutcome>;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// --- M-Pesa (Safaricom Daraja, STK Push) -----------------------------------

type DarajaConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackSecret: string;
};

export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  let national: string | null = null;
  if (/^254[17]\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^0[17]\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^[17]\d{8}$/.test(digits)) national = digits;
  if (!national) throw invalid("Enter a valid Safaricom number, for example 0712 345 678.", { phone: ["Invalid phone number."] });
  return `254${national}`;
}

/** Extracts the outcome from a Daraja STK callback body. Exported for tests. */
export function parseStkCallback(rawBody: string): PaymentOutcome | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const callback = (parsed as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
  if (!callback || typeof callback.CheckoutRequestID !== "string") return null;
  const items = (callback.CallbackMetadata as { Item?: Array<{ Name?: string; Value?: unknown }> } | undefined)?.Item ?? [];
  const value = (name: string) => items.find((i) => i.Name === name)?.Value;
  const success = Number(callback.ResultCode) === 0;
  const amount = Number(value("Amount"));
  return {
    providerReference: callback.CheckoutRequestID,
    outcome: success ? "succeeded" : "failed",
    receiptNumber: success && value("MpesaReceiptNumber") ? String(value("MpesaReceiptNumber")) : undefined,
    amountCents: success && Number.isFinite(amount) ? Math.round(amount * 100) : undefined,
    failureReason: success ? undefined : String(callback.ResultDesc ?? "Payment was not completed."),
  };
}

class MpesaProvider implements PaymentProvider {
  readonly id = "mpesa" as const;
  readonly label = "M-Pesa";
  readonly isSandbox = false;
  readonly supportedCurrencies = ["KES"];
  constructor(private readonly config: DarajaConfig) {}

  normalizePhone = normalizeKenyanPhone;

  private timestamp() {
    // Daraja expects East Africa Time (UTC+3) as YYYYMMDDHHmmss.
    return new Date(Date.now() + 3 * 3600_000).toISOString().replace(/[-:T]/g, "").slice(0, 14);
  }

  private password(timestamp: string) {
    return Buffer.from(`${this.config.shortcode}${this.config.passkey}${timestamp}`).toString("base64");
  }

  private async token(): Promise<string> {
    const basic = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString("base64");
    const response = await fetch(`${this.config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${basic}` },
      cache: "no-store",
    });
    if (!response.ok) throw new AppError("UNAVAILABLE", "The payment service could not be reached. Try again shortly.");
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new AppError("UNAVAILABLE", "The payment service rejected our credentials.");
    return data.access_token;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return (await response.json().catch(() => ({}))) as T;
  }

  async initiate(input: InitiateInput) {
    if (input.amountCents % 100 !== 0) throw invalid("M-Pesa amounts must be whole shillings.");
    const timestamp = this.timestamp();
    const callbackUrl = `${env().NEXT_PUBLIC_APP_URL}/api/payments/mpesa/callback/${this.config.callbackSecret}`;
    const data = await this.post<{ ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string }>(
      "/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: this.config.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: input.amountCents / 100,
        PartyA: input.phone,
        PartyB: this.config.shortcode,
        PhoneNumber: input.phone,
        CallBackURL: callbackUrl,
        AccountReference: input.transactionId.slice(0, 12),
        TransactionDesc: input.description.slice(0, 13),
      },
    );
    if (data.ResponseCode !== "0" || !data.CheckoutRequestID) {
      console.error("[mpesa] STK push rejected", data.errorMessage ?? data.ResponseCode);
      throw new AppError("UNAVAILABLE", "M-Pesa could not start the payment. Check the number and try again.");
    }
    return {
      providerReference: data.CheckoutRequestID,
      instructions: "Check your phone and enter your M-Pesa PIN to approve the payment.",
    };
  }

  /**
   * Daraja does not sign callbacks. Authenticity rests on the secret path
   * token and, before any enrollment is activated, on `queryStatus` below.
   */
  async parseCallback(request: CallbackRequest) {
    if (!safeEqual(request.token, this.config.callbackSecret)) return null;
    return parseStkCallback(request.rawBody);
  }

  async queryStatus(providerReference: string): Promise<PaymentOutcome> {
    const timestamp = this.timestamp();
    const data = await this.post<{ ResultCode?: string | number; ResultDesc?: string; errorCode?: string }>(
      "/mpesa/stkpushquery/v1/query",
      {
        BusinessShortCode: this.config.shortcode,
        Password: this.password(timestamp),
        Timestamp: timestamp,
        CheckoutRequestID: providerReference,
      },
    );
    if (data.ResultCode === undefined) return { providerReference, outcome: "pending" };
    if (Number(data.ResultCode) === 0) return { providerReference, outcome: "succeeded" };
    return { providerReference, outcome: "failed", failureReason: data.ResultDesc ?? "Payment was not completed." };
  }
}

// --- Sandbox (development and automated tests only) ------------------------

export function signSandboxBody(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

class SandboxProvider implements PaymentProvider {
  readonly id = "sandbox" as const;
  readonly label = "Sandbox (test payments)";
  readonly isSandbox = true;
  readonly supportedCurrencies = ["KES", "USD", "EUR", "GBP", "UGX", "TZS"];
  constructor(private readonly secret: string) {}

  normalizePhone(phone: string) {
    return phone.replace(/[^\d+]/g, "").slice(0, 20) || "0000000000";
  }

  async initiate(input: InitiateInput) {
    return {
      providerReference: `SBX-${input.transactionId}`,
      instructions: "Sandbox mode: no money moves. Use the test controls to complete or fail this payment.",
    };
  }

  async parseCallback(request: CallbackRequest) {
    const signature = request.headers.get("x-sandbox-signature") ?? "";
    if (!safeEqual(signature, signSandboxBody(request.rawBody, this.secret))) return null;
    try {
      const body = JSON.parse(request.rawBody) as PaymentOutcome;
      if (typeof body.providerReference !== "string") return null;
      if (body.outcome !== "succeeded" && body.outcome !== "failed") return null;
      return body;
    } catch {
      return null;
    }
  }
}

// --- Selection -------------------------------------------------------------

export type PaymentStatus =
  | { enabled: true; provider: PaymentProvider }
  | { enabled: false; reason: string };

let override: PaymentProvider | null | undefined;

/** Test hook. */
export function setPaymentProvider(provider: PaymentProvider | null | undefined) {
  override = provider;
}

export function getPaymentStatus(): PaymentStatus {
  if (override !== undefined) {
    return override ? { enabled: true, provider: override } : { enabled: false, reason: "Payments are disabled." };
  }
  const e = env();
  if (e.PAYMENT_PROVIDER === "disabled") {
    return { enabled: false, reason: "Online payments are not enabled on this platform yet." };
  }
  if (e.PAYMENT_PROVIDER === "sandbox") {
    if (isProductionRuntime()) {
      return { enabled: false, reason: "The sandbox payment provider cannot be used in production." };
    }
    return { enabled: true, provider: new SandboxProvider(e.BETTER_AUTH_SECRET) };
  }
  const missing = (
    ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_SECRET"] as const
  ).filter((k) => !e[k]);
  if (missing.length > 0) {
    return { enabled: false, reason: `M-Pesa is selected but not configured (missing ${missing.join(", ")}).` };
  }
  if ((e.MPESA_CALLBACK_SECRET ?? "").length < 24) {
    return { enabled: false, reason: "MPESA_CALLBACK_SECRET must be at least 24 characters." };
  }
  return {
    enabled: true,
    provider: new MpesaProvider({
      baseUrl: e.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
      consumerKey: e.MPESA_CONSUMER_KEY!,
      consumerSecret: e.MPESA_CONSUMER_SECRET!,
      shortcode: e.MPESA_SHORTCODE!,
      passkey: e.MPESA_PASSKEY!,
      callbackSecret: e.MPESA_CALLBACK_SECRET!,
    }),
  };
}

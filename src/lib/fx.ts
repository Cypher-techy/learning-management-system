import type { BillingInterval, Settings } from "./db";
import { subscriptionPlanOption, type SubscriptionPlanOption } from "./pricing";

const DEFAULT_FX_URL = "https://api.frankfurter.dev/v2/rate/usd/kes";
const FX_CACHE_MS = 5 * 60 * 1000;
const FX_TIMEOUT_MS = 8000;
const MAX_RATE_AGE_MS = 10 * 24 * 60 * 60 * 1000;

export interface UsdKesRate {
  rate: number;
  rateDate: string;
  source: string;
  fetchedAt: string;
}

export interface SubscriptionQuote extends SubscriptionPlanOption {
  transactionCurrency: "KES";
  amountKES: number;
  exchangeRateUSDKES: number;
  exchangeRateDate: string;
  exchangeRateSource: string;
  quotedAt: string;
}

let cachedRate: (UsdKesRate & { endpoint: string; cachedAt: number }) | null = null;

function extractRate(data: any): number {
  return Number(
    data?.rate ??
    data?.rates?.KES ??
    data?.conversion_rates?.KES ??
    data?.conversion_rate,
  );
}

function extractRateDate(data: any): string {
  const candidate = data?.date || data?.time_last_update_utc || data?.lastUpdatedAt || data?.timestamp;
  if (typeof candidate === "number") return new Date(candidate * 1000).toISOString();
  if (typeof candidate === "string" && candidate.trim()) {
    const parsed = new Date(candidate);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Fetch the latest available USD→KES reference rate at transaction time.
 * The default endpoint is Frankfurter's current ( dateless ) USD/KES pair,
 * so the result automatically follows the calendar in every year. There is
 * deliberately no hardcoded fallback rate: checkout fails honestly rather
 * than charging a guessed amount when the provider is unavailable.
 */
export async function getLatestUsdKesRate(): Promise<UsdKesRate> {
  const endpoint = process.env.USD_KES_RATE_URL || DEFAULT_FX_URL;
  if (cachedRate?.endpoint === endpoint && Date.now() - cachedRate.cachedAt < FX_CACHE_MS) {
    const { endpoint: _endpoint, cachedAt: _cachedAt, ...rate } = cachedRate;
    return rate;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "ElimuBora/1.0 currency-quote" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Exchange-rate provider returned HTTP ${response.status}.`);

    const data = await response.json();
    const rate = extractRate(data);
    const rateDate = extractRateDate(data);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Exchange-rate provider returned an invalid USD/KES rate.");
    if (Date.now() - new Date(rateDate).getTime() > MAX_RATE_AGE_MS) {
      throw new Error("Exchange-rate provider returned a stale USD/KES rate.");
    }

    const result: UsdKesRate = {
      rate,
      rateDate,
      source: typeof data?.source === "string" && data.source.trim()
        ? data.source
        : process.env.USD_KES_RATE_URL
          ? "Configured exchange-rate provider"
          : "Frankfurter",
      fetchedAt: new Date().toISOString(),
    };
    cachedRate = { ...result, endpoint, cachedAt: Date.now() };
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The live USD/KES exchange-rate request timed out.");
    }
    throw error instanceof Error ? error : new Error("The live USD/KES exchange rate is unavailable.");
  } finally {
    clearTimeout(timer);
  }
}

export async function quoteSubscription(
  settings: Partial<Settings>,
  interval: BillingInterval,
): Promise<SubscriptionQuote> {
  const plan = subscriptionPlanOption(settings, interval);
  const fx = await getLatestUsdKesRate();
  return {
    ...plan,
    transactionCurrency: "KES",
    // Daraja is charged in whole Kenyan shillings.
    amountKES: Math.max(1, Math.round(plan.priceUSD * fx.rate)),
    exchangeRateUSDKES: fx.rate,
    exchangeRateDate: fx.rateDate,
    exchangeRateSource: fx.source,
    quotedAt: fx.fetchedAt,
  };
}

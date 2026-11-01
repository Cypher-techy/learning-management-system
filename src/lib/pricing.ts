import type { BillingInterval, Plan, Settings } from "./db";

export const DEFAULT_MONTHLY_PRICE_USD = 35;
export const DEFAULT_ANNUAL_PRICE_USD = 240;
export const MONTHLY_PLAN_ID = "plan_premium_monthly";
export const ANNUAL_PLAN_ID = "plan_premium_annual";

export interface SubscriptionPlanOption {
  id: string;
  name: string;
  billingInterval: BillingInterval;
  intervalDays: number;
  displayCurrency: "USD";
  priceUSD: number;
  equivalentMonthlyUSD: number;
  billingLabel: string;
  termLabel: string;
}

function positivePrice(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : fallback;
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export function subscriptionPlanOptions(settings: Partial<Settings>): SubscriptionPlanOption[] {
  const monthlyPriceUSD = positivePrice(settings.premiumMonthlyPriceUSD, DEFAULT_MONTHLY_PRICE_USD);
  const annualPriceUSD = positivePrice(settings.premiumAnnualPriceUSD, DEFAULT_ANNUAL_PRICE_USD);

  return [
    {
      id: MONTHLY_PLAN_ID,
      name: "Elimu Bora Premium — Monthly",
      billingInterval: "monthly",
      intervalDays: 30,
      displayCurrency: "USD",
      priceUSD: monthlyPriceUSD,
      equivalentMonthlyUSD: monthlyPriceUSD,
      billingLabel: "Billed for 30 days via M-Pesa",
      termLabel: "30 days of all-access Premium",
    },
    {
      id: ANNUAL_PLAN_ID,
      name: "Elimu Bora Premium — Annual",
      billingInterval: "annual",
      intervalDays: 365,
      displayCurrency: "USD",
      priceUSD: annualPriceUSD,
      equivalentMonthlyUSD: Math.round((annualPriceUSD / 12) * 100) / 100,
      billingLabel: "Billed once for 365 days via M-Pesa",
      termLabel: "365 days of all-access Premium",
    },
  ];
}

export function subscriptionPlanOption(
  settings: Partial<Settings>,
  interval: BillingInterval,
): SubscriptionPlanOption {
  return subscriptionPlanOptions(settings).find((plan) => plan.billingInterval === interval)!;
}

export function subscriptionPlanRecords(settings: Partial<Settings>): Plan[] {
  return subscriptionPlanOptions(settings).map((plan) => ({
    id: plan.id,
    name: plan.name,
    priceUSD: plan.priceUSD,
    billingInterval: plan.billingInterval,
    intervalDays: plan.intervalDays,
  }));
}

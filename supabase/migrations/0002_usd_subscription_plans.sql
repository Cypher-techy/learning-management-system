-- USD display pricing with KES settlement for M-Pesa.
-- The running Next.js JSON-state store migrates itself to contentVersion 5;
-- this file keeps the normalized production schema aligned for a future
-- relational cutover.

alter table subscription_plans
  add column if not exists display_price_usd numeric(12,2),
  add column if not exists display_currency text not null default 'USD',
  add column if not exists billing_interval text not null default 'monthly';

alter table subscriptions
  add column if not exists plan_id uuid references subscription_plans(id),
  add column if not exists billing_interval text not null default 'monthly',
  add column if not exists interval_days int not null default 30;

alter table payment_transactions
  add column if not exists plan_id uuid references subscription_plans(id),
  add column if not exists billing_interval text not null default 'monthly',
  add column if not exists interval_days int not null default 30,
  add column if not exists display_currency text not null default 'USD',
  add column if not exists display_amount_usd numeric(12,2),
  add column if not exists exchange_rate_usd_kes numeric(18,8),
  add column if not exists exchange_rate_date timestamptz,
  add column if not exists exchange_rate_source text,
  add column if not exists quoted_at timestamptz;

comment on column subscription_plans.display_price_usd is
  'Customer-facing USD price. M-Pesa amount remains whole KES converted at checkout.';
comment on column payment_transactions.exchange_rate_usd_kes is
  'Latest USD/KES reference rate fetched server-side when this payment was quoted.';

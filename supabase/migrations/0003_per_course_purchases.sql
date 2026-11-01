-- Independent lifetime course purchases.
-- The running Next.js state store migrates itself to contentVersion 6; this
-- migration keeps the normalized production schema aligned for a relational
-- cutover. It intentionally retains subscription_plans/subscriptions: terms
-- sold under the former all-access model remain stored and honoured until
-- their original expiry dates, but those plans are archived for new sales.

alter table courses
  add column if not exists price_kes int,
  add column if not exists transaction_currency text not null default 'KES',
  add column if not exists price_set_by uuid references profiles(id),
  add column if not exists price_set_at timestamptz;

-- Existing premium courses: preserve any already-valid price. Known catalogue
-- prices match the JSON-state migration; unknown courses use a deterministic
-- level-based price inside the current KSh 350-500 band.
update courses
set price_kes = case slug
      when 'python-data' then 499
      when 'business-finance' then 450
      when 'ml-intro' then 500
      when 'ui-design' then 399
      else case level
        when 'Advanced' then 500
        when 'Intermediate' then 475
        when 'All levels' then 450
        else 400
      end
    end,
    transaction_currency = 'KES',
    price_set_at = coalesce(price_set_at, now()),
    updated_at = now()
where access = 'premium'
  and (price_kes is null or price_kes not between 350 and 500);

-- Any stored course price must be within the current band, and a published
-- premium course must have a price. Draft premium courses may remain
-- temporarily unpriced so the application can block submission/publication
-- with a useful error rather than inventing a price.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courses_price_kes_band') then
    alter table courses
      add constraint courses_price_kes_band
      check (price_kes is null or price_kes between 350 and 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'courses_published_premium_price') then
    alter table courses
      add constraint courses_published_premium_price
      check (
        access <> 'premium'
        or status <> 'published'
        or price_kes between 350 and 500
      ) not valid;
  end if;
end $$;

alter table courses validate constraint courses_price_kes_band;
alter table courses validate constraint courses_published_premium_price;

comment on column courses.price_kes is
  'Canonical whole-KES M-Pesa price for a premium course. Learner-facing USD is derived from this value and the latest USD/KES rate.';
comment on column courses.price_set_by is
  'Only the owning tutor or platform owner (super admin) may set course pricing, before publication.';

create table if not exists course_price_history (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  old_price_kes int,
  new_price_kes int,
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- For direct authenticated writes, only the owning tutor or owner can change
-- access/pricing, and neither can change pricing after publication. Trusted
-- server writes use the service role (auth.uid() is null) and enforce the
-- same rules in src/lib/pricing.ts and the pricing API.
create or replace function public.enforce_course_pricing_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if tg_op = 'UPDATE'
     and old.status = 'published'
     and (new.price_kes is distinct from old.price_kes or new.access is distinct from old.access) then
    raise exception 'Course pricing and paid/free access cannot change after publication.'
      using errcode = '42501';
  end if;

  if actor_id is not null
     and (
       tg_op = 'INSERT'
       or new.price_kes is distinct from old.price_kes
       or new.access is distinct from old.access
     )
     and actor_id <> new.tutor_id
     and not exists (
       select 1 from public.profiles
       where id = actor_id and role = 'owner'
     ) then
    raise exception 'Only the course tutor or super admin can set course pricing.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' or new.price_kes is distinct from old.price_kes then
    new.price_set_at := now();
    if actor_id is not null then
      new.price_set_by := actor_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists courses_pricing_authority on courses;
create trigger courses_pricing_authority
before insert or update of access, price_kes on courses
for each row execute function public.enforce_course_pricing_authority();

create or replace function public.record_course_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.price_kes is not null then
    insert into public.course_price_history(course_id, old_price_kes, new_price_kes, changed_by)
    values (new.id, null, new.price_kes, auth.uid());
  elsif tg_op = 'UPDATE' and new.price_kes is distinct from old.price_kes then
    insert into public.course_price_history(course_id, old_price_kes, new_price_kes, changed_by)
    values (new.id, old.price_kes, new.price_kes, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists courses_price_history_record on courses;
create trigger courses_price_history_record
after insert or update of price_kes on courses
for each row execute function public.record_course_price_change();

create table if not exists course_purchases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  payment_id uuid unique references payment_transactions(id),
  price_kes int not null check (price_kes between 350 and 500),
  display_currency text not null default 'USD',
  display_amount_usd numeric(12,4),
  status text not null default 'active' check (status in ('active','refunded','revoked')),
  purchased_at timestamptz not null default now()
);

create unique index if not exists idx_course_purchases_active_unique
  on course_purchases(student_id, course_id)
  where status = 'active';
create index if not exists idx_course_purchases_course
  on course_purchases(course_id, purchased_at desc);
create index if not exists idx_course_purchases_student
  on course_purchases(student_id, purchased_at desc);

alter table payment_transactions
  add column if not exists kind text not null default 'subscription',
  add column if not exists course_id uuid references courses(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_transactions_kind_check') then
    alter table payment_transactions
      add constraint payment_transactions_kind_check
      check (kind in ('course_purchase','subscription'));
  end if;
end $$;

update payment_transactions
set kind = 'subscription'
where course_id is null and (kind is null or kind = '');

create index if not exists idx_payments_course
  on payment_transactions(course_id, created_at desc);

-- A verified course payment may credit its tutor exactly once. Legacy pool
-- allocations keep payment_id null and remain governed by period uniqueness.
alter table wallet_transactions
  add column if not exists payment_id uuid references payment_transactions(id),
  add column if not exists course_id uuid references courses(id);

create unique index if not exists idx_wallet_course_sale_payment_unique
  on wallet_transactions(payment_id)
  where type = 'earning' and payment_id is not null;

-- Archive former all-access plans for new sales without deleting the plans,
-- payments or subscriptions that learners already bought.
alter table subscription_plans
  add column if not exists sales_status text not null default 'active';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscription_plans_sales_status_check') then
    alter table subscription_plans
      add constraint subscription_plans_sales_status_check
      check (sales_status in ('active','archived'));
  end if;
end $$;

update subscription_plans set sales_status = 'archived' where sales_status <> 'archived';
alter table subscription_plans alter column sales_status set default 'archived';

comment on table course_purchases is
  'Lifetime entitlement to one individually purchased premium course, created only after verified payment.';
comment on column payment_transactions.kind is
  'course_purchase for new per-course sales; subscription only for legacy all-access history.';
comment on column subscription_plans.sales_status is
  'Archived plans are retained for history and existing terms but must not be sold.';

-- Access helpers. has_premium() is retained under its existing name for
-- compatibility, but it now means only a still-active legacy subscription.
create or replace function public.has_course_purchase(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.course_purchases
    where student_id = auth.uid()
      and course_id = target_course
      and status = 'active'
  )
$$;

create or replace function public.has_course_access(target_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.courses c
    where c.id = target_course
      and (
        c.access = 'free'
        or c.tutor_id = auth.uid()
        or public.is_owner()
        or public.is_verified_admin()
        or public.has_course_purchase(target_course)
        or public.has_premium()
      )
  )
$$;

alter table course_purchases enable row level security;
alter table course_price_history enable row level security;

drop policy if exists course_purchases_read on course_purchases;
create policy course_purchases_read on course_purchases for select using (
  student_id = auth.uid()
  or public.is_verified_admin()
  or public.is_owner()
  or exists(select 1 from public.courses c where c.id = course_id and c.tutor_id = auth.uid())
);
-- Inserts/updates happen only through the trusted payment server (service role).

drop policy if exists course_price_history_read on course_price_history;
create policy course_price_history_read on course_price_history for select using (
  public.is_owner()
  or public.is_verified_admin()
  or exists(select 1 from public.courses c where c.id = course_id and c.tutor_id = auth.uid())
);

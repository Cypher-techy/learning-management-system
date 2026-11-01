# Elimu Bora — Learn Beyond Limits

A complete, modern Learning Management System for Kenya and beyond: free & premium learning, verified tutors, M-Pesa subscriptions, usage-based tutor revenue sharing, and verifiable certificates.

## Stack

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS**
- **GSAP ScrollTrigger + Lenis** cinematic scrolling on public pages; **Framer Motion** UI transitions; **Lucide** icons
- **Data layer:** `src/lib/db.ts` stores application state in **Supabase Postgres** when `SUPABASE_DATABASE_URL` is set (use the transaction-pooler string, port 6543; the state table is created automatically), and falls back to a local JSON file under `data/` for development — or the OS temp directory on read-only serverless filesystems. The normalized production **Supabase Postgres** schema + RLS policies also ship in `supabase/migrations/`
- **M-Pesa Daraja** STK Push, idempotent callback, and STK Query reconciliation (`src/lib/mpesa.ts`)

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app runs without external services
npm run dev                  # http://localhost:3000
```

On first run the database seeds itself with realistic courses, users and financial history.

## What works end-to-end

- Public role selection → Student or Tutor authentication; **database role is always authoritative** (portal selection can never escalate access)
- Student accounts are created and auto-verified in one step at registration (no email code); tutor application → internal approval; administrator accounts are provisioned internally and cannot be created through public registration
- **Free tutorial track** in W3Schools-style format — Windows Basics, Microsoft Word, Excel & PowerPoint, and HTML/Web Foundations — with structured notes, step-by-step instructions, shortcut tables, exercises with model answers, and editable *Try It* code runners
- Marketplace with search/filters; course pages with locked premium previews (protected media is never sent to unauthorised clients)
- Classroom: video/reading lessons, resume-where-you-left-off, progress, quizzes (MCQ/true-false/short-answer, attempt limits, auto-grading), assignments + grading + feedback, discussions, reporting, study assistant constrained to authorised material
- Certificates gated on 100% completion + quiz passes; public verification page (`/verify`)
- Udemy-style monthly and annual all-access subscriptions via Daraja STK Push: plan prices are configured/displayed in USD, while each M-Pesa transaction is charged in whole KES converted server-side from the latest USD/KES rate fetched at checkout; premium activates **only** on a verified Safaricom callback or STK Query confirmation; renewal extends expiry; expiry preserves all progress
- Monthly revenue allocation: net revenue → configurable tutor pool (default 80%) weighted by verified premium engagement; single-allocation guarantee; wallets, statements, idempotent withdrawals, admin-approved payouts with references
- Admin console: verification queues, moderation, finance, reports, announcements, audit logs, configurable settings/pricing
- Branded startup loading experience, pinned horizontal course discovery, parallax hero, animated real statistics, `prefers-reduced-motion` support

## Environment

See `.env.example`. Highlights:

- `USD_KES_RATE_URL` — optional server-only override for the live USD/KES rate endpoint. When blank, checkout uses Frankfurter's current dateless USD/KES endpoint, so conversion follows the latest available rate in any year; no exchange-rate fallback is hardcoded.
- `MPESA_*` — required for live/sandbox STK Push. **Without valid credentials the checkout returns an explicit "not configured" error; payments are never simulated.** For a Paybill, `MPESA_SHORTCODE` is the Paybill and the type is `CustomerPayBillOnline`. For a Till, `MPESA_SHORTCODE` is the Store/Head Office (H.O.) go-live number, `MPESA_TILL_NUMBER` is the actual Till sent as `PartyB`, and the type is `CustomerBuyGoodsOnline`.
- `SUPABASE_DATABASE_URL` — **required on Vercel** for durable accounts/data. Use Supabase's *transaction pooler* connection string (port `6543`), not the direct/session string. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` cover Supabase API/storage use; the normalized schema remains in `supabase/migrations/0001_edvora_init.sql`.
- `RESEND_API_KEY` + `EMAIL_FROM` — student registration is auto-verified without email, so Resend is not required for students. It is required in production for tutor contact-verification codes. For temporary launch testing only, `ALLOW_REGISTRATION_CODE_DISPLAY=true` shows tutor applicants' codes on the registration page; remove it afterwards.
- `SESSION_SECRET` — set a long random value in production so sign-in sessions are stable across serverless instances.
- `OPENAI_API_KEY` — optional; without it the study assistant falls back to on-platform retrieval over authorised lessons.
- Additional server-only bootstrap variables are documented in `.env.example`; initialisation is one-time and self-invalidating.

## Verification

```bash
npm run build
npm run start &
npm run verify    # §28 acceptance checks: authz, premium gating, certificates, hierarchy, payments
```

## Deployment (Vercel)

1. Import the repo; framework preset: Next.js.
2. Add all environment variables from `.env.example` (production scope). In particular, set `SUPABASE_DATABASE_URL` to Supabase's **transaction pooler** string (port `6543`) and set `SESSION_SECRET`. The app creates its state table automatically on first request; the SQL in `supabase/migrations/` remains the normalized schema for a later full relational cutover.
3. Students register and are auto-verified without an email provider. Configure `RESEND_API_KEY`/`EMAIL_FROM` for tutor verification emails (or temporarily use `ALLOW_REGISTRATION_CODE_DISPLAY=true` while testing that flow).
4. Set `MPESA_CALLBACK_URL` to the public HTTPS URL `https://<domain>/api/payments/mpesa/callback`. For a Till, also set `MPESA_TILL_NUMBER` and `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline`; `MPESA_SHORTCODE` remains the Store/Head Office go-live number. USD plan prices are converted to KES at checkout using the live rate endpoint (`USD_KES_RATE_URL` may override the default Frankfurter endpoint).
5. Redeploy after changing environment variables, then run `BASE=https://<domain> npm run verify` and test a fresh student registration end-to-end.

## Project layout

```
src/app            routes (public site, auth, dashboards, API)
src/components     shared UI (splash, nav, dashboard shell, cards…)
src/lib            db + seed, auth/session, Daraja, revenue/overview services
supabase/          production Postgres schema & RLS
scripts/verify.mjs acceptance tests
public/brand       Elimu Bora logo assets
```

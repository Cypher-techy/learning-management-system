# Elimu Bora — Learn Beyond Limits

A complete, modern Learning Management System for Kenya and beyond: free & premium learning, verified tutors, independent M-Pesa course purchases, direct per-sale tutor revenue sharing, and verifiable certificates.

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
- **Independent lifetime course purchases** via Daraja STK Push: each premium course has its own whole-KES transaction price in the current **KSh 350–500** band, set before publication only by that course's tutor or the super admin. Learners see the price in USD derived server-side from the latest USD/KES rate, while M-Pesa charges the course's exact stored KES price. Access to that one course activates **only** on a verified Safaricom callback or STK Query confirmation; already-owned and legacy-covered courses cannot be charged again, and all progress is preserved
- Per-sale tutor revenue: the configured tutor share (default 70% tutor / 30% platform) is credited **once** to the selling tutor's wallet when a course payment is verified. Subscriptions sold under the former all-access model remain honoured to their original expiry dates and are allocated separately, so course-sale revenue is never paid twice; wallets, statements, idempotent withdrawals and admin-approved payouts retain references
- Admin console: verification queues, moderation, finance, reports, announcements, audit logs and configurable settings. Regular administrators can review course pricing but cannot set or change it
- Branded startup loading experience, pinned horizontal course discovery, parallax hero, animated real statistics, `prefers-reduced-motion` support

## Environment

See `.env.example`. Highlights:

- `USD_KES_RATE_URL` — optional server-only override for the live USD/KES rate endpoint. When blank, course-price display and checkout use Frankfurter's current dateless USD/KES endpoint, so the USD amount (`stored course price_KES ÷ latest rate`) follows the latest available rate in any year; no exchange-rate fallback is hardcoded. The M-Pesa charge remains the course's exact stored whole-KES price.
- `MPESA_*` — required for live/sandbox STK Push. **Without valid credentials the checkout returns an explicit "not configured" error; payments are never simulated.** For a Paybill, `MPESA_SHORTCODE` is the Paybill and the type is `CustomerPayBillOnline`. For a Till, `MPESA_SHORTCODE` is the Store/Head Office (H.O.) go-live number, `MPESA_TILL_NUMBER` is the actual Till sent as `PartyB`, and the type is `CustomerBuyGoodsOnline`.
- `SUPABASE_DATABASE_URL` — **required on Vercel** for durable accounts/data. Use Supabase's *transaction pooler* connection string (port `6543`), not the direct/session string. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` cover Supabase API/storage use; the normalized schema remains in `supabase/migrations/`.
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
4. Set `MPESA_CALLBACK_URL` to the public HTTPS URL `https://<domain>/api/payments/mpesa/callback`. For a Till, also set `MPESA_TILL_NUMBER` and `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline`; `MPESA_SHORTCODE` remains the Store/Head Office go-live number. Each premium course's learner-facing USD price is derived from its stored KSh 350–500 price using the live rate endpoint (`USD_KES_RATE_URL` may override the default Frankfurter endpoint); M-Pesa charges that exact stored KES amount. Existing course prices migrate automatically in the app state and through `supabase/migrations/0003_per_course_purchases.sql` for the normalized schema.
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

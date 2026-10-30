# EDVORA — Learn Beyond Limits

A complete, modern Learning Management System for Kenya and beyond: free & premium learning, verified tutors, M-Pesa subscriptions, usage-based tutor revenue sharing, and verifiable certificates.

## Stack

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS**
- **GSAP ScrollTrigger + Lenis** cinematic scrolling on public pages; **Framer Motion** UI transitions; **Lucide** icons
- **Data layer:** `src/lib/db.ts` stores application state in **Supabase Postgres** when `SUPABASE_DATABASE_URL` is set (use the transaction-pooler string, port 6543; the state table is created automatically), and falls back to a local JSON file under `data/` for development — or the OS temp directory on read-only serverless filesystems. The normalized production **Supabase Postgres** schema + RLS policies also ship in `supabase/migrations/`
- **M-Pesa Daraja** STK Push + idempotent callback (`src/lib/mpesa.ts`)

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app runs without external services
npm run dev                  # http://localhost:3000
```

On first run the database seeds itself with realistic courses, users and financial history.

## Preview accounts

Choose the matching account type on the sign-in screen (quick-fill buttons included):

| Account type | Email | Password | Notes |
|---|---|---|---|
| Student (Free) | faith@example.co.ke | Learn@2026 | Free plan |
| Student (Premium) | david@example.co.ke | Learn@2026 | Active subscription, 1 certificate |
| Tutor | amina@edvora.ac.ke | Teach@2026 | Verified, with earnings |
| Tutor | peter@edvora.ac.ke | Teach@2026 | Verified, pending withdrawal |
| Tutor applicant | kevin.omondi@example.co.ke | Kevin@2026 | Pending verification |
| Administrator | admin@edvora.ac.ke | Admin@2026 | Verified |

## What works end-to-end

- Role selection → role-specific auth with contact-verification codes; **database role is always authoritative** (portal selection can never escalate access)
- Student auto-verification; tutor application → admin approval; controlled administrator appointment
- **Free tutorial track** in W3Schools-style format — Windows Basics, Microsoft Word, Excel & PowerPoint, and HTML/Web Foundations — with structured notes, step-by-step instructions, shortcut tables, exercises with model answers, and editable *Try It* code runners
- Marketplace with search/filters; course pages with locked premium previews (protected media is never sent to unauthorised clients)
- Classroom: video/reading lessons, resume-where-you-left-off, progress, quizzes (MCQ/true-false/short-answer, attempt limits, auto-grading), assignments + grading + feedback, discussions, reporting, study assistant constrained to authorised material
- Certificates gated on 100% completion + quiz passes; public verification page (`/verify`)
- Subscriptions via Daraja STK Push; premium activates **only** on verified callback; renewal extends expiry; expiry preserves all progress
- Monthly revenue allocation: net revenue → configurable tutor pool (default 80%) weighted by verified premium engagement; single-allocation guarantee; wallets, statements, idempotent withdrawals, admin-approved payouts with references
- Admin console: verification queues, moderation, finance, reports, announcements, audit logs, configurable settings/pricing
- Branded startup loading experience, pinned horizontal course discovery, parallax hero, animated real statistics, `prefers-reduced-motion` support

## Environment

See `.env.example`. Highlights:

- `MPESA_*` — required for live/sandbox STK Push. **Without credentials the checkout returns an explicit "not configured" error; payments are never simulated.**
- `SUPABASE_DATABASE_URL` — **required on Vercel** for durable accounts/data. Use Supabase's *transaction pooler* connection string (port `6543`), not the direct/session string. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` cover Supabase API/storage use; the normalized schema remains in `supabase/migrations/0001_edvora_init.sql`.
- `RESEND_API_KEY` + `EMAIL_FROM` — required in production so registration verification codes are actually emailed. For temporary launch testing only, `ALLOW_REGISTRATION_CODE_DISPLAY=true` shows the code on the registration page; remove it before real learners register.
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
3. Configure `RESEND_API_KEY`/`EMAIL_FROM` for verification emails (or temporarily use `ALLOW_REGISTRATION_CODE_DISPLAY=true` while testing).
4. Set `MPESA_CALLBACK_URL` to `https://<domain>/api/payments/mpesa/callback` and register it with Safaricom.
5. Redeploy after changing environment variables, then run `BASE=https://<domain> npm run verify` and test a fresh student registration end-to-end.

## Project layout

```
src/app            routes (public site, auth, dashboards, API)
src/components     shared UI (splash, nav, dashboard shell, cards…)
src/lib            db + seed, auth/session, Daraja, revenue/overview services
supabase/          production Postgres schema & RLS
scripts/verify.mjs acceptance tests
public/brand       EDVORA logo assets
```

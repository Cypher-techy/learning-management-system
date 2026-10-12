# Learning Management System

A standalone learning platform: public course catalog, learner workspace, instructor course builder, assessments and grading, verifiable certificates, and an administration console.

Powered by Cypher Green Systems (CGS). This is an independent project with its own code, database, authentication and deployment. It shares nothing with any other CGS application.

- [Architecture, database schema and permission matrix](docs/ARCHITECTURE.md)
- [Implementation status](docs/STATUS.md): what is complete, what needs credentials, what is not built
- [Security notes and known limitations](docs/SECURITY.md)

## Technology

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| UI | Tailwind CSS 4, shadcn/ui components, lucide icons, Recharts |
| Database | PostgreSQL, Drizzle ORM, versioned SQL migrations in `drizzle/` |
| Authentication | Better Auth (email and password, database sessions, scrypt hashing) |
| Validation | Zod on the server for every input; React Hook Form in the question editor |
| Files | Private storage behind an authorizing route: S3-compatible bucket, or local disk for development |
| Email | SMTP through Nodemailer |
| Payments | Provider abstraction with M-Pesa (Daraja STK Push) and a development sandbox |
| Tests | Vitest (unit and integration on in-process PostgreSQL), Playwright (browser) |

## Folder structure

```
drizzle/                 SQL migrations (generated, committed, forward-only)
scripts/                 migrate, seed (development only), create-admin
src/
  app/
    (public)/            homepage, catalog, course pages, policies, verify, teach
    (auth)/              sign-in, register, password recovery
    (account)/           account, notifications, discussions, checkout
    learn/               learner dashboard, course player, exams, assignments
    instructor/          course builder, assessments, grading, analytics
    admin/               users, courses, enrollments, payments, settings, audit
    actions/             server actions (thin: parse form, call a service)
    api/                 auth, uploads, file downloads, certificates, exports, webhooks, health
  components/            ui (shadcn), kit (forms, tables, dialogs), feature components
  lib/                   env validation, formatting, form helpers
  server/
    db/                  Drizzle schema and connection
    auth/                Better Auth configuration and session helpers
    services/            ALL business rules and authorization live here
    queries/             read models for pages
    payments/            payment providers
    permissions.ts       roles and the permission matrix
tests/
  unit/  integration/    Vitest
  e2e/                   Playwright
```

The rule that keeps the system secure: **pages and actions never decide who may do something. They call a service, and the service checks.** Hiding a button is never the control.

## Local development

Requirements: Node.js 20.9 or newer (developed on 24), Docker (for PostgreSQL), Git.

```bash
git clone https://github.com/Cypher-techy/learning-management-system.git
cd learning-management-system
npm install

cp .env.example .env.local
# Set BETTER_AUTH_SECRET in .env.local:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

npm run db:up        # starts PostgreSQL 17 on 127.0.0.1:5544 (docker compose)
npm run db:migrate   # applies the migrations
npm run db:seed      # OPTIONAL: demonstration data, see below
npm run dev          # http://localhost:3000
```

### Demonstration data

`npm run db:seed` fills an **empty development database** with clearly labelled demo content. Every seeded address ends in `@example.test` and every seeded course title starts with `[Demo]`.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@example.test | demo-password-123 |
| Instructor | instructor@example.test | demo-password-123 |
| Learner | learner@example.test | demo-password-123 |
| Learner | learner2@example.test | demo-password-123 |

The script refuses to run when `NODE_ENV=production` and refuses to run against a database that already contains users. Set `SEED_PASSWORD` to use a different password. Never seed production.

In development, with no SMTP server configured, emails (including password reset links) are printed to the terminal running `npm run dev`.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit and integration tests |
| `npm run test:e2e` | Browser tests |
| `npm run db:up` | Start local PostgreSQL |
| `npm run db:generate` | Generate a migration after changing the schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Demonstration data (development only) |
| `npm run admin:create` | Provision an administrator |

## Environment variables

`.env.example` documents every variable. Summary:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL, no trailing slash. Must be `https://` in production. |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | yes | At least 32 random characters. Different in every environment. |
| `REQUIRE_EMAIL_VERIFICATION` | no | `true` recommended in production (needs SMTP). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | production | Without SMTP no email is delivered in production. |
| `STORAGE_DRIVER` | yes | `s3` in production, `local` for development. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | with `s3` | Any S3-compatible service. |
| `CGS_WEBSITE_URL` | no | Official CGS site for the footer link. Leave empty until confirmed. |
| `PAYMENT_PROVIDER` | no | `disabled` (default), `mpesa`, or `sandbox` (refused in production). |
| `MPESA_*` | with `mpesa` | See Payments. |
| `HEALTHCHECK_TOKEN` | no | Unlocks detail on `/api/health`. |
| `DATABASE_POOL_MAX`, `DATABASE_DISABLE_PREPARE` | no | Pool size; set `DATABASE_DISABLE_PREPARE=true` behind a transaction-mode pooler. |

Never commit `.env*` files with real values. `.gitignore` excludes all of them except `.env.example`.

## Creating the first administrator

Public registration can only ever create learners. The role field cannot be set through any sign-up or profile request. The first administrator is created with a command run by someone who already has database access:

```bash
npm run admin:create -- --email you@example.com --name "Your Name"
```

You are prompted for a password (not echoed). For non-interactive use, set `ADMIN_PASSWORD` in the environment for that one command. The password is never accepted as a command-line argument. To promote an existing account instead, add `--promote`. The action is written to the audit log.

After that, administrators create further users and assign roles from **Admin > Users**. Learners become instructors by applying at `/teach` and being approved under **Admin > Instructor applications**.

## Production deployment

Use separate databases, secrets and storage buckets for development, test and production.

### 1. Database

Create a managed PostgreSQL 15+ database (Neon, Supabase, RDS, Render, Railway or similar) with automated backups enabled. Set `DATABASE_URL` to its connection string. For serverless hosting use the provider's pooled connection string and set `DATABASE_DISABLE_PREPARE=true` if the pooler runs in transaction mode.

Apply migrations as a deployment step, before the new version receives traffic:

```bash
DATABASE_URL="postgres://..." npm run db:migrate
```

Migrations are forward-only SQL files. The application never generates, runs or resets them on its own.

### 2. File storage

Create a **private** bucket on an S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces). Do not enable public access. Set:

```
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket
S3_REGION=auto            # or your region
S3_ENDPOINT=https://...   # omit for AWS S3
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false # true for MinIO
```

Give the access key only `PutObject`, `GetObject` and `DeleteObject` on that bucket. Enable object versioning so files can be recovered.

Files are never linked directly. Every download goes through `/api/files/<id>`, which checks the requester's rights and then redirects to a signed URL that expires after five minutes.

`STORAGE_DRIVER=local` writes to the server's disk. That is fine on your laptop and wrong on any host with an ephemeral filesystem.

**Upload size.** Uploads pass through the application server. Vercel limits request bodies to about 4.5 MB, so on Vercel keep lesson videos on a streaming service (YouTube, Vimeo, Cloudflare Stream, Bunny) and paste the link into the lesson, which is also the better choice for learners on slow connections. On a Node.js host there is no such limit beyond the "Maximum file size" setting.

### 3. Email

Set the `SMTP_*` variables for any SMTP provider (Amazon SES, Postmark, Mailgun, Brevo, a Google Workspace relay). Set `EMAIL_FROM` to an address on a domain you have verified with that provider. Then set `REQUIRE_EMAIL_VERIFICATION=true`.

### 4. Application

**Vercel:** import the repository, add the environment variables for the Production environment, and set the build command to `npm run db:migrate && npm run build` (or run migrations from CI). 

**Any Node.js host (Render, Railway, Fly.io, a VPS):**

```bash
npm ci
npm run db:migrate
npm run build
npm start            # serves on PORT (default 3000)
```

Run it behind HTTPS. Set `NEXT_PUBLIC_APP_URL` to the public `https://` address: session cookies are marked `Secure` only when it is.

### 5. After the first deploy

1. Create the administrator (`npm run admin:create`, with the production `DATABASE_URL`).
2. Sign in and open **Admin > System health**. Every check should be green.
3. In **Admin > Settings**, set the platform name, support contacts, and the official CGS website URL once it is confirmed.
4. In **Admin > Categories and tags**, create at least one category (courses need one to be published).
5. Review the Terms, Privacy and Refund pages with your legal adviser. They describe what this software does but are general-purpose text, not legal advice.

## Authentication

Better Auth provides email and password sign-in with database-backed sessions.

- Passwords: scrypt, minimum 10 characters.
- Sessions: 7 days, HTTP-only cookies, `SameSite=Lax`, `Secure` over HTTPS. Stored in the database so they can be revoked.
- Password reset: single-use link, expires after one hour, signs out all other sessions.
- Rate limiting on sign-in, sign-up and reset endpoints (database-backed, active in production).
- Suspending a user or changing their role deletes their sessions immediately.
- Role-changing, suspension, account deletion, course deletion, permission edits and refund decisions require the administrator to re-enter their password.

## Payments

Paid courses are off by default (`PAYMENT_PROVIDER=disabled`). Paid courses can still be created; learners see that online payment is not available and administrators can grant access manually.

### How it works

1. Checkout creates a **pending** transaction. No access is granted.
2. The provider calls `/api/payments/<provider>/callback/<secret>`.
3. The callback is authenticated, then **confirmed with the provider by a separate server-to-server query**.
4. Inside one database transaction the payment is marked succeeded and the enrollment is activated. The transaction row is locked, so duplicate or concurrent callbacks do nothing.
5. An amount lower than the price fails the payment.

A success message in the browser never grants access.

### M-Pesa (Daraja STK Push)

1. Create an app at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) and obtain the consumer key and secret. For live payments, complete Safaricom's go-live process for your paybill or till to obtain the production shortcode and passkey.
2. Set:

```
PAYMENT_PROVIDER=mpesa
MPESA_ENV=sandbox              # then production
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_SECRET=<at least 24 random characters>
```

3. The callback URL sent with each request is `https://<your-domain>/api/payments/mpesa/callback/<MPESA_CALLBACK_SECRET>`. It must be reachable over public HTTPS.
4. Course prices must be in KES and whole shillings.

Daraja does not sign its callbacks. Authenticity therefore rests on the secret in the callback path plus the STK status query made before any enrollment is activated. Restricting the callback route to Safaricom's published IP ranges at your firewall is a worthwhile addition.

**Status: implemented against Safaricom's documented API but not exercised against live Daraja, because that requires credentials.** The callback parser, phone normalisation, idempotency and verification logic are covered by automated tests using a stand-in provider. Run a sandbox payment end to end before going live.

### Sandbox provider

`PAYMENT_PROVIDER=sandbox` enables a clearly labelled test provider with "simulate success" and "simulate failure" buttons that send a signed callback through the real verification path. It is refused when `NODE_ENV=production`.

### Refunds

Learners request a refund from **Purchases**; administrators decide under **Admin > Payments**. Approving marks the transaction refunded and cancels access. **The system does not move money.** Return the payment through the provider's portal.

### Adding another provider

Implement the `PaymentProvider` interface in `src/server/payments/providers.ts` (`initiate`, `parseCallback`, optional `queryStatus`) and register it in `getPaymentStatus()`.

## Tests

```bash
npm test             # 79 unit and integration tests
npm run test:e2e     # browser tests
```

**Unit and integration** tests run each file against a fresh in-process PostgreSQL (PGlite) with the real migrations applied. They need no Docker and cannot reach any real database: `DATABASE_URL` is cleared before the code loads.

**Browser** tests start the app on port 3100 against a disposable database (`lms_e2e` by default, override with `E2E_DATABASE_URL`). That database is **wiped and re-seeded on every run**; the setup refuses any database whose name does not end in `_e2e`. Create it once:

```bash
docker exec lms-postgres psql -U lms -d lms_dev -c "CREATE DATABASE lms_e2e"
npx playwright install chromium
```

What is covered is listed in [docs/STATUS.md](docs/STATUS.md).

## Backup and recovery

The application does not take backups. Configure them where the data lives.

**Database**

- Enable automated daily backups and point-in-time recovery with your PostgreSQL provider.
- For a manual backup: `pg_dump --format=custom --no-owner "$DATABASE_URL" > lms-$(date +%F).dump`
- To restore into an empty database: `pg_restore --no-owner --dbname "$NEW_DATABASE_URL" lms-YYYY-MM-DD.dump`, then point `DATABASE_URL` at it and run `npm run db:migrate`.

**Files**

- Enable versioning on the bucket. To copy it elsewhere: `aws s3 sync s3://your-bucket s3://your-backup-bucket`.
- The `files` table maps each stored object to its owner and purpose. Restore database and bucket to the same point in time where possible. An object without a `files` row is unreachable; a row without an object returns "not found".

**Secrets**

- Keep `BETTER_AUTH_SECRET` in your secret manager. If it is lost or rotated, every user is signed out; no data is lost.

Rehearse a restore into a staging environment at least once before you depend on it.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Invalid environment configuration` | A required variable is missing or malformed. The message names it. |
| `DATABASE_URL is not set` | Copy `.env.example` to `.env.local`, or export the variable for scripts. |
| `ECONNREFUSED 127.0.0.1:5544` | PostgreSQL is not running: `npm run db:up`. |
| `relation "users" does not exist` | Migrations have not been applied: `npm run db:migrate`. |
| Signed in, then immediately signed out | `NEXT_PUBLIC_APP_URL` does not match the address in the browser, or it is `https://` while you are browsing over `http://`. |
| No emails arrive | SMTP is not configured (see **Admin > System health**). In development they are printed to the terminal. |
| "The file is too large for the server to accept" | The host's request limit is lower than the upload setting. See File storage. |
| Uploaded files disappear after a deploy | `STORAGE_DRIVER=local` on an ephemeral host. Switch to `s3`. |
| A course cannot be published | The Publication panel lists exactly what is missing. |
| An instructor cannot publish directly | By design. Turn off "Require administrator review" in Settings or grant `course.publish_direct` under Roles and permissions. |
| `prepared statement already exists` | You are behind a transaction-mode pooler: set `DATABASE_DISABLE_PREPARE=true`. |
| Seed refuses to run | The database already has users, or `NODE_ENV=production`. Both are deliberate. |

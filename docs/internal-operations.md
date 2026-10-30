# EDVORA — Internal Operations (confidential)

This document is for platform operators only. Do not link it from public pages.

## Privileged initialisation
1. Set server-only env vars `OWNER_EMAIL` and `OWNER_SETUP_SECRET` (Vercel → Environment Variables; never `NEXT_PUBLIC_`).
2. Deploy. Visit the unlisted initialisation route once and complete setup with a 12+ character password (enable TOTP MFA in the identity provider immediately after).
3. The setup secret is invalidated on first use; redeploys cannot re-run initialisation or duplicate the account.
4. Remove `OWNER_SETUP_SECRET` from the environment after initialisation.

## Account recovery (highest privilege)
If credentials are lost:
1. Verify the requester's identity out-of-band against company records.
2. Take a database backup. Rotate `SESSION_SECRET` (invalidates all sessions, including any hijacked ones).
3. Using the service-role key (Supabase) or direct data-layer access, reset the password hash via the platform's own hashing utility and force `status='verified'`.
4. Record the recovery in the audit log (`platform.recovery`) with operator identity and ticket reference.
5. Sign in, rotate the password again, and re-enrol MFA.

Never share recovery steps publicly; never perform recovery from an unverified request.

## Administrator lifecycle
- Administrators are invited/created and approved exclusively from the control console.
- Suspend immediately on suspicion; review the audit log before restoring.

## Payments reconciliation (daily)
- Compare `payment_transactions` with Safaricom statements; investigate `payment.mismatch` audit events.
- Callbacks are idempotent on CheckoutRequestID; duplicates are safe to ignore.

## Backups
- Production (Supabase): enable PITR. Built-in data layer: back up `data/edvora.json` before every deploy.

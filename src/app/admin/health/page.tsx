import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { CircleAlert, CircleCheck } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { PageHeader, Section } from "@/components/kit/primitives";
import { env } from "@/lib/env";
import { requireRole } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPaymentStatus } from "@/server/payments/providers";
import { isEmailConfigured } from "@/server/services/email";
import { storageStatus } from "@/server/services/storage";

export const metadata: Metadata = { title: "System health" };

type Check = { name: string; ok: boolean; detail: string };

async function databaseChecks(): Promise<{ checks: Check[]; migration: { hash: string; at: Date } | null }> {
  const started = Date.now();
  try {
    const versionResult = await db.execute(sql`select current_setting('server_version') as version, pg_database_size(current_database())::bigint as size`);
    const info = (versionResult as unknown as Array<{ version: string; size: string | number }>)[0];
    const latency = Date.now() - started;
    let migration: { hash: string; at: Date } | null = null;
    try {
      const rows = (await db.execute(
        sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`,
      )) as unknown as Array<{ hash: string; created_at: string | number }>;
      if (rows[0]) migration = { hash: String(rows[0].hash).slice(0, 12), at: new Date(Number(rows[0].created_at)) };
    } catch {
      migration = null;
    }
    return {
      checks: [
        { name: "Database connection", ok: true, detail: `PostgreSQL ${info?.version ?? ""} · responded in ${latency} ms` },
        {
          name: "Database size",
          ok: true,
          detail: info ? `${(Number(info.size) / (1024 * 1024)).toFixed(1)} MB` : "Unknown",
        },
      ],
      migration,
    };
  } catch (error) {
    console.error("[health] database check failed", error);
    return { checks: [{ name: "Database connection", ok: false, detail: "The database did not respond." }], migration: null };
  }
}

export default async function HealthPage() {
  await requireRole("admin");
  const e = env();
  const { checks: dbChecks, migration } = await databaseChecks();
  const storage = storageStatus();
  const payments = getPaymentStatus();
  const https = e.NEXT_PUBLIC_APP_URL.startsWith("https://");

  const checks: Check[] = [
    ...dbChecks,
    { name: "File storage", ok: storage.durable, detail: storage.note },
    {
      name: "Email delivery",
      ok: isEmailConfigured(),
      detail: isEmailConfigured() ? "SMTP is configured." : "SMTP is not configured: password reset and notification emails cannot be delivered.",
    },
    {
      name: "Email verification",
      ok: e.REQUIRE_EMAIL_VERIFICATION,
      detail: e.REQUIRE_EMAIL_VERIFICATION ? "New accounts must confirm their email address." : "Not required. Recommended for production.",
    },
    {
      name: "Payments",
      ok: payments.enabled && !payments.provider.isSandbox,
      detail: payments.enabled ? `${payments.provider.label}${payments.provider.isSandbox ? " (test mode, not for production)" : ""}` : payments.reason,
    },
    {
      name: "Secure transport",
      ok: https,
      detail: https ? "The site address uses HTTPS; session cookies are marked Secure." : `The configured address is ${e.NEXT_PUBLIC_APP_URL}. Use HTTPS in production.`,
    },
  ];

  return (
    <>
      <PageHeader title="System health" description="Operational status of the services this platform depends on." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Service checks">
          <ul className="divide-y">
            {checks.map((check) => (
              <li key={check.name} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                {check.ok ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="OK" />
                ) : (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-label="Needs attention" />
                )}
                <div>
                  <p className="font-medium">{check.name}</p>
                  <p className="text-sm text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <div className="space-y-6">
          <Section title="Database migrations">
            {migration ? (
              <p className="text-sm">
                Latest applied migration <span className="font-mono">{migration.hash}</span>, created <LocalTime value={migration.at} />.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Migration history could not be read.</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              Migrations are applied with <span className="font-mono">npm run db:migrate</span> during deployment. They
              are never run or reset automatically by the application.
            </p>
          </Section>

          <Section title="Backups">
            <p className="text-sm">
              This application does not take or monitor database backups itself. Backups are the responsibility of your
              PostgreSQL provider.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Enable automated daily backups and point-in-time recovery in your database provider&apos;s console.</li>
              <li>Enable versioning on the file storage bucket so deleted or overwritten files can be restored.</li>
              <li>Test a restore regularly. The procedure is in the README under Backup and recovery.</li>
            </ul>
          </Section>

          <Section title="Monitoring endpoint">
            <p className="text-sm">
              <span className="font-mono">GET /api/health</span> returns <span className="font-mono">200</span> when the
              database is reachable and <span className="font-mono">503</span> otherwise. Component detail is returned only
              with the <span className="font-mono">HEALTHCHECK_TOKEN</span> bearer token.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Environment: {e.NODE_ENV}</p>
          </Section>
        </div>
      </div>
    </>
  );
}

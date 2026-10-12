import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, GraduationCap, TriangleAlert, Users, Wallet } from "lucide-react";
import { SimpleBarChart, SimpleLineChart } from "@/components/kit/charts";
import { LocalTime } from "@/components/kit/datetime-field";
import { LinkButton, PageHeader, Section, StatCard } from "@/components/kit/primitives";
import { formatMoney } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getPaymentStatus } from "@/server/payments/providers";
import { adminOverview } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminOverviewPage() {
  const actor = await requireRole("admin");
  const data = await adminOverview(actor);
  const payments = getPaymentStatus();
  const completion = data.enrollments.total === 0 ? 0 : Math.round((data.enrollments.completed / data.enrollments.total) * 100);
  const alerts = [
    { n: data.alerts.pendingCourses, label: "courses awaiting review", href: "/admin/courses?status=pending_review" },
    { n: data.alerts.pendingApplications, label: "instructor applications to review", href: "/admin/instructors" },
    { n: data.alerts.openSupport, label: "open support requests", href: "/admin/support" },
    { n: data.alerts.openReports, label: "reported posts", href: "/admin/support" },
    { n: data.alerts.openRefunds, label: "refund requests", href: "/admin/payments" },
  ].filter((a) => a.n > 0);

  return (
    <>
      <PageHeader title="Platform overview" description="Live figures from the database." />

      {alerts.length > 0 && (
        <section aria-label="Needs attention" className="mb-6 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 text-warning" aria-hidden /> Needs attention
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {alerts.map((alert) => (
              <li key={alert.href + alert.label}>
                <Link href={alert.href} className="text-primary hover:underline">
                  {alert.n} {alert.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Registered users"
          value={data.users.total}
          hint={`${data.users.students} learners · ${data.users.instructors} instructors · ${data.users.admins} admins`}
          icon={Users}
          href="/admin/users"
        />
        <StatCard
          label="Published courses"
          value={data.courses.published}
          hint={`${data.courses.total} in total, ${data.courses.draft} drafts`}
          icon={BookOpen}
          href="/admin/courses"
        />
        <StatCard
          label="Enrollments"
          value={data.enrollments.total}
          hint={`${data.enrollments.active} active · ${completion}% completed`}
          icon={GraduationCap}
          href="/admin/enrollments"
        />
        <StatCard
          label="Certificates issued"
          value={data.certificates.valid}
          hint={data.certificates.revoked > 0 ? `${data.certificates.revoked} revoked` : undefined}
          icon={Award}
          href="/admin/certificates"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="New users per week" description="Last 12 weeks">
          {data.signups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No registrations in this period.</p>
          ) : (
            <SimpleBarChart data={data.signups} x="week" y="users" label="New users" />
          )}
        </Section>
        <Section title="Enrollments per week" description="Last 12 weeks">
          {data.enrollmentTrend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrollments in this period.</p>
          ) : (
            <SimpleLineChart data={data.enrollmentTrend} x="week" y="enrollments" label="Enrollments" />
          )}
        </Section>

        <Section title="Assessments" actions={<LinkButton href="/admin/assessments" variant="ghost" size="sm">Details</LinkButton>}>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Figure label="Graded attempts" value={data.attempts.graded} />
            <Figure label="Awaiting grading" value={data.attempts.awaiting} />
            <Figure label="Average score" value={data.attempts.average === null ? "-" : `${data.attempts.average}%`} />
            <Figure label="Pass rate" value={data.attempts.passRate === null ? "-" : `${data.attempts.passRate}%`} />
          </dl>
        </Section>

        <Section title="Revenue" actions={<LinkButton href="/admin/payments" variant="ghost" size="sm">Payments</LinkButton>}>
          {!payments.enabled ? (
            <p className="text-sm text-muted-foreground">{payments.reason}</p>
          ) : data.revenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {data.revenue.map((r) => (
                <li key={r.currency} className="flex items-center gap-3">
                  <Wallet className="size-4 text-muted-foreground" aria-hidden />
                  <span className="text-xl font-semibold tabular-nums">{formatMoney(r.totalCents, r.currency)}</span>
                  <span className="text-sm text-muted-foreground">from {r.payments} payments</span>
                </li>
              ))}
            </ul>
          )}
          {payments.enabled && payments.provider.isSandbox && (
            <p className="mt-3 text-xs text-warning">Sandbox provider active: figures include test payments.</p>
          )}
        </Section>

        <Section
          title="Recent administrative activity"
          className="lg:col-span-2"
          actions={<LinkButton href="/admin/audit" variant="ghost" size="sm">Audit log</LinkButton>}
        >
          {data.recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.recentAudit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span>
                    <span className="font-mono text-xs">{entry.action}</span>
                    <span className="text-muted-foreground"> by {entry.actorName ?? "system"}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    <LocalTime value={entry.createdAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

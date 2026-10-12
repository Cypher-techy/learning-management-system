import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { decideRefundAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { first, LinkButton, PageHeader, pageParam, Pagination, Section, StatusBadge, withParams, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { getPaymentStatus } from "@/server/payments/providers";
import { listPayments } from "@/server/queries/admin";
import { listRefundRequests } from "@/server/services/payments";

export const metadata: Metadata = { title: "Payments" };

const PAGE_SIZE = 25;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = first(sp.status);
  const page = pageParam(sp.page);
  const actor = await requirePermission("payment.manage");
  const [{ rows, total }, refunds] = await Promise.all([
    listPayments(actor, { status, page, pageSize: PAGE_SIZE }),
    listRefundRequests(actor),
  ]);
  const provider = getPaymentStatus();
  const open = refunds.filter((r) => r.refund.status === "requested");

  return (
    <>
      <PageHeader title="Payments" description="Transaction records and refund requests." />

      <div
        className={`mb-6 rounded-xl border p-4 text-sm ${provider.enabled && !provider.provider.isSandbox ? "bg-card" : "border-warning/40 bg-warning/5"}`}
      >
        {provider.enabled ? (
          <p className="flex items-start gap-2">
            {provider.provider.isSandbox && <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
            <span>
              <span className="font-medium">Payment provider: {provider.provider.label}.</span>{" "}
              {provider.provider.isSandbox
                ? "Test mode. No real money moves and the transactions below are not real revenue. This provider is refused in production."
                : "Enrollments are activated only after the provider confirms each payment."}
            </span>
          </p>
        ) : (
          <p>
            <span className="font-medium">Payments are disabled.</span> {provider.reason} See the payment configuration
            section of the README.
          </p>
        )}
      </div>

      <Section title={`Refund requests (${open.length} open)`} className="mb-6">
        {refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refund requests.</p>
        ) : (
          <ul className="divide-y">
            {refunds.map(({ refund, transaction, courseTitle, learnerName, learnerEmail }) => (
              <li key={refund.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{learnerName}</span> <span className="text-muted-foreground">({learnerEmail})</span>
                  </p>
                  <p className="text-sm">
                    {courseTitle} · {formatMoney(transaction.amountCents, transaction.currency)}
                    {transaction.receiptNumber ? ` · receipt ${transaction.receiptNumber}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Reason: {refund.reason}</p>
                  {refund.reviewNote && <p className="mt-1 text-sm text-muted-foreground">Decision note: {refund.reviewNote}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Requested <LocalTime value={refund.createdAt} />
                  </p>
                </div>
                {refund.status === "requested" ? (
                  <div className="flex gap-2">
                    <ConfirmAction
                      action={decideRefundAction}
                      fields={{ refundId: refund.id, decision: "approve" }}
                      title="Approve this refund?"
                      description="The transaction is marked refunded and the learner loses access to the course. This system does not move money: return the payment through the provider's own tools."
                      reasonField={{ name: "note", label: "Note to the learner (optional)" }}
                      requirePassword
                      confirmLabel="Approve refund"
                      variant="default"
                      size="sm"
                    >
                      Approve
                    </ConfirmAction>
                    <ConfirmAction
                      action={decideRefundAction}
                      fields={{ refundId: refund.id, decision: "reject" }}
                      title="Decline this refund?"
                      reasonField={{ name: "note", label: "Reason (shared with the learner)" }}
                      requirePassword
                      confirmLabel="Decline"
                      destructive
                      size="sm"
                    >
                      Decline
                    </ConfirmAction>
                  </div>
                ) : (
                  <StatusBadge status={refund.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <h2 className="mb-3 text-lg font-semibold">Transactions</h2>
      <FilterBar
        clearHref="/admin/payments"
        selects={[
          {
            name: "status",
            label: "Status",
            value: status,
            options: [
              { value: "", label: "Any status" },
              { value: "succeeded", label: "Succeeded" },
              { value: "pending", label: "Pending" },
              { value: "failed", label: "Failed" },
              { value: "refunded", label: "Refunded" },
            ],
          },
        ]}
      >
        <LinkButton href="/api/export/payments" variant="outline" prefetch={false}>
          Export CSV
        </LinkButton>
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Learner</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No transactions recorded.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ transaction, learnerName, learnerEmail, courseTitle }) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <p className="font-medium">{learnerName}</p>
                  <p className="text-xs text-muted-foreground">{learnerEmail}</p>
                </TableCell>
                <TableCell>{courseTitle}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(transaction.amountCents, transaction.currency)}</TableCell>
                <TableCell>{transaction.provider}</TableCell>
                <TableCell className="font-mono text-xs">{transaction.receiptNumber ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={transaction.status} />
                  {transaction.failureReason && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{transaction.failureReason}</p>}
                </TableCell>
                <TableCell>
                  <LocalTime value={transaction.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/payments", { status }, { page: p })} />
    </>
  );
}

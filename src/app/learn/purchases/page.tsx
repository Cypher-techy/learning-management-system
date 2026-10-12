import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requestRefundAction } from "@/app/actions/learner";
import { ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { listMyPayments } from "@/server/services/payments";

export const metadata: Metadata = { title: "Purchases" };

export default async function PurchasesPage() {
  const actor = await requireActor("/learn/purchases");
  const payments = await listMyPayments(actor);

  return (
    <>
      <PageHeader title="Purchases" description="Your payment history and receipts." />
      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No purchases" description="Payments for paid courses will be listed here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map(({ transaction, courseTitle, courseSlug, refunds }) => {
                const open = refunds.find((r) => r.status === "requested");
                const decided = refunds.find((r) => r.status !== "requested");
                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <Link href={`/courses/${courseSlug}`} className="font-medium hover:underline">
                        {courseTitle}
                      </Link>
                      {transaction.status === "failed" && transaction.failureReason && (
                        <p className="text-xs text-muted-foreground">{transaction.failureReason}</p>
                      )}
                      {decided?.status === "rejected" && (
                        <p className="text-xs text-muted-foreground">
                          Refund declined{decided.reviewNote ? `: ${decided.reviewNote}` : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <LocalTime value={transaction.createdAt} />
                    </TableCell>
                    <TableCell className="tabular-nums">{formatMoney(transaction.amountCents, transaction.currency)}</TableCell>
                    <TableCell className="font-mono text-xs">{transaction.receiptNumber ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={transaction.status} />
                      {open && <p className="mt-1 text-xs text-muted-foreground">Refund under review</p>}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.status === "pending" && (
                        <Link href={`/checkout/status/${transaction.id}`} className="text-primary hover:underline">
                          Check status
                        </Link>
                      )}
                      {transaction.status === "succeeded" && !open && (
                        <ConfirmAction
                          action={requestRefundAction}
                          fields={{ transactionId: transaction.id }}
                          title="Request a refund"
                          description="An administrator will review your request. If it is approved, your access to the course ends."
                          reasonField={{ name: "reason", label: "Reason for the request", required: true }}
                          confirmLabel="Send request"
                          variant="ghost"
                          size="sm"
                        >
                          Request refund
                        </ConfirmAction>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

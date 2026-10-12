import type { Metadata } from "next";
import { CircleCheck, CircleX, FlaskConical, Loader2 } from "lucide-react";
import { refreshPaymentAction, sandboxPaymentAction } from "@/app/actions/learner";
import { ActionButton } from "@/components/kit/confirm";
import { LinkButton, PageHeader } from "@/components/kit/primitives";
import { PaymentPoller } from "@/components/learn/payment-poller";
import { formatMoney } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { getPaymentStatus } from "@/server/payments/providers";
import { load, uuidParam } from "@/server/page";
import { getMyPayment } from "@/server/services/payments";

export const metadata: Metadata = { title: "Payment status" };

export default async function PaymentStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requireActor(`/checkout/status/${id}`);
  const { transaction, courseTitle, courseSlug } = await load(() => getMyPayment(actor, id));
  const payments = getPaymentStatus();
  const sandbox = payments.enabled && payments.provider.isSandbox && transaction.provider === "sandbox";

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Payment status" description={courseTitle} />
      <div className="rounded-xl border bg-card p-6 text-center" role="status" data-testid="payment-status" data-status={transaction.status}>
        {transaction.status === "pending" && (
          <>
            <PaymentPoller />
            <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">Waiting for payment confirmation</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              {transaction.provider === "mpesa"
                ? "Check your phone and enter your M-Pesa PIN to approve the payment. This page updates automatically."
                : "This page updates automatically once the payment is confirmed."}
            </p>
            <div className="mt-4">
              <ActionButton action={refreshPaymentAction} fields={{ transactionId: id }}>
                Check payment status
              </ActionButton>
            </div>
          </>
        )}
        {transaction.status === "succeeded" && (
          <>
            <CircleCheck className="mx-auto size-8 text-success" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">Payment received</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatMoney(transaction.amountCents, transaction.currency)}
              {transaction.receiptNumber ? ` · Receipt ${transaction.receiptNumber}` : ""}
            </p>
            <LinkButton href={`/learn/courses/${courseSlug}`} className="mt-4">
              Start learning
            </LinkButton>
          </>
        )}
        {(transaction.status === "failed" || transaction.status === "refunded") && (
          <>
            <CircleX className="mx-auto size-8 text-destructive" aria-hidden />
            <h2 className="mt-3 text-lg font-semibold">
              {transaction.status === "refunded" ? "Payment refunded" : "Payment not completed"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {transaction.failureReason ?? (transaction.status === "refunded" ? "This payment was refunded." : "No money was taken.")}
            </p>
            {transaction.status === "failed" && (
              <LinkButton href={`/checkout/${courseSlug}`} className="mt-4">
                Try again
              </LinkButton>
            )}
          </>
        )}
      </div>

      {sandbox && transaction.status === "pending" && (
        <div className="mt-6 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4 text-warning" aria-hidden /> Sandbox test controls
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            These buttons stand in for the payment provider. They send a signed test callback through the same
            verification path a real provider uses. They do not exist outside test mode.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton action={sandboxPaymentAction} fields={{ transactionId: id, outcome: "succeeded" }}>
              Simulate successful payment
            </ActionButton>
            <ActionButton action={sandboxPaymentAction} fields={{ transactionId: id, outcome: "failed" }}>
              Simulate failed payment
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

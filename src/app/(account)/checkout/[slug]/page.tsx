import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { checkoutAction } from "@/app/actions/learner";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/kit/form";
import { LinkButton, PageHeader, Section } from "@/components/kit/primitives";
import { formatMoney } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPaymentStatus } from "@/server/payments/providers";
import { getPublishedCourse } from "@/server/queries/catalog";
import { getEnrollment } from "@/server/services/enrollment";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await requireActor(`/checkout/${slug}`);
  const data = await getPublishedCourse(slug);
  if (!data) notFound();
  const { course } = data;
  if (course.priceCents <= 0) redirect(`/courses/${slug}`);
  const enrollment = await getEnrollment(db, actor.id, course.id);
  if (enrollment && (enrollment.status === "active" || enrollment.status === "completed")) {
    redirect(`/learn/courses/${slug}`);
  }
  const payments = getPaymentStatus();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Checkout" back={{ href: `/courses/${slug}`, label: "Back to course" }} />
      <Section title="Order summary">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium">{course.title}</p>
            <p className="text-sm text-muted-foreground">Full course access</p>
          </div>
          <p className="shrink-0 text-lg font-semibold">{formatMoney(course.priceCents, course.currency)}</p>
        </div>
      </Section>

      <Section title="Payment" className="mt-6">
        {!payments.enabled ? (
          <>
            <p className="text-sm">{payments.reason}</p>
            <LinkButton href="/contact" variant="outline" className="mt-3">
              Contact support
            </LinkButton>
          </>
        ) : (
          <>
            {payments.provider.isSandbox && (
              <p className="mb-4 flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <strong>Test mode.</strong> The sandbox payment provider is active. No real money is charged and this
                  mode cannot run in production.
                </span>
              </p>
            )}
            <ActionForm action={checkoutAction} className="grid gap-4">
              <input type="hidden" name="courseId" value={course.id} />
              <FormMessage />
              <TextField
                label={payments.provider.id === "mpesa" ? "M-Pesa phone number" : "Phone number"}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0712 345 678"
                required
                hint={
                  payments.provider.id === "mpesa"
                    ? "You will receive a prompt on this phone to enter your M-Pesa PIN."
                    : "Any number is accepted in test mode."
                }
              />
              <div>
                <SubmitButton size="lg" pendingLabel="Starting payment...">
                  Pay {formatMoney(course.priceCents, course.currency)} with {payments.provider.label}
                </SubmitButton>
              </div>
              <p className="text-xs text-muted-foreground">
                Access is granted once the payment provider confirms the payment. See the refund policy for refunds.
              </p>
            </ActionForm>
          </>
        )}
      </Section>
    </div>
  );
}

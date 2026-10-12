import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose-page";
import { getPaymentStatus } from "@/server/payments/providers";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  const payments = getPaymentStatus();
  return (
    <ProsePage title="Refund policy" updated="October 2026">
      {!payments.enabled && (
        <p>
          <strong>Online payments are not currently enabled on this platform.</strong> This policy applies to paid
          courses once payments are available.
        </p>
      )}
      <h2>Requesting a refund</h2>
      <ul>
        <li>
          Sign in and open <Link href="/learn/purchases">Purchases</Link>. Choose the payment and select Request a
          refund, giving a short reason.
        </li>
        <li>Requests are reviewed by an administrator. You are notified of the decision in the platform and by email.</li>
      </ul>
      <h2>When refunds are normally approved</h2>
      <ul>
        <li>You were charged more than once for the same course.</li>
        <li>You bought a course by mistake and have not completed a substantial part of it.</li>
        <li>The course was withdrawn or became unavailable before you could reasonably complete it.</li>
      </ul>
      <h2>When refunds are normally declined</h2>
      <ul>
        <li>A certificate has already been issued for the course.</li>
        <li>The request follows a suspension for breaching the terms of service or examination rules.</li>
      </ul>
      <h2>How refunds are paid</h2>
      <p>
        Approved refunds are returned to the original payment method through the payment provider. When a refund is
        approved, access to the course ends. Processing times depend on the provider.
      </p>
      <h2>Questions</h2>
      <p>
        If something does not look right with a payment, <Link href="/contact">contact support</Link> and include the
        receipt number.
      </p>
    </ProsePage>
  );
}

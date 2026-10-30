import StaticPage, { H, P, UL } from "@/components/StaticPage";
export const metadata = { title: "Terms & Conditions" };
export default function Terms() {
  return <StaticPage eyebrow="Legal" title="Terms & Conditions">
    <H>1. Accounts</H><UL items={["You must provide accurate registration information and keep credentials confidential.", "Student accounts are verified after contact confirmation.", "Tutor accounts require administrative verification before publishing or earning.", "Administrator access is granted only through Elimu Bora's controlled appointment process.", "We may suspend accounts that violate these terms, with audit records retained."]} />
    <H>2. Subscriptions & payments</H><UL items={["Premium is a monthly all-access subscription covering eligible premium courses.", "Payment is via M-Pesa; access activates on confirmed payment only.", "Subscriptions do not auto-renew. Renewal is manual via a new payment.", "Learning progress and records are preserved after expiry."]} />
    <H>3. Tutor revenue</H><P>Net distributable subscription revenue is shared under the configured revenue model (default 80% tutor pool / 20% platform). Allocations are usage-based, published as monthly statements, and withdrawals are subject to review, configured minimums and payout verification.</P>
    <H>4. Content & conduct</H><UL items={["Tutors warrant they have rights to content they upload.", "Course material is for enrolled learners; redistribution is prohibited.", "Harassment, spam and academic dishonesty may lead to removal and suspension.", "Certificates may be revoked for proven misconduct, with reasons recorded."]} />
    <H>5. Liability</H><P>Elimu Bora provides the platform "as is" and makes reasonable efforts to maintain availability and data integrity. To the extent permitted by Kenyan law, liability is limited to amounts paid in the preceding three months.</P>
  </StaticPage>;
}

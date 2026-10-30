import StaticPage, { H, P } from "@/components/StaticPage";
export const metadata = { title: "FAQs" };
const QA = [
  ["Is EDVORA free?", "Yes — free accounts include free courses, quizzes, assignments, progress tracking, discussions and more. Premium is optional and unlocks every premium course."],
  ["How do I pay for Premium?", "With M-Pesa. You receive an STK Push on your phone, enter your PIN, and access activates automatically once Safaricom confirms payment."],
  ["Does Premium auto-renew?", "No. M-Pesa does not silently rebill you. We remind you before expiry and you renew with one tap. Your account and progress are never deleted when a subscription expires."],
  ["Are certificates genuine?", "Certificates require full lesson completion and passing assessments. Each carries a unique code verifiable on our public verification page."],
  ["How do teachers get paid?", "Monthly. 80% of net subscription revenue forms the teacher pool (configurable by EDVORA), allocated by verified premium student engagement. Teachers request withdrawals to M-Pesa or bank; payouts are reviewed and recorded with transaction references."],
  ["Can I learn on my phone?", "Absolutely — EDVORA is mobile-first and designed to remain usable on slower connections."],
  ["How do I become a teacher?", "Apply via the Teacher / Lecturer option. Verification is required before you can publish or earn."],
];
export default function Faq() {
  return <StaticPage eyebrow="Help" title="Frequently Asked Questions">
    {QA.map(([q, a]) => <div key={q}><H>{q}</H><P>{a}</P></div>)}
  </StaticPage>;
}

import StaticPage, { H, P } from "@/components/StaticPage";
export const metadata = { title: "FAQs" };
const QA = [
  ["Is Elimu Bora free?", "Yes — free accounts include free courses, quizzes, assignments, progress tracking, discussions and more. Premium courses are optional and are bought one at a time."],
  ["How do I pay for a premium course?", "Open the course, choose Buy This Course, then approve the M-Pesa STK Push. The course price is displayed in USD using the latest exchange rate; M-Pesa charges the exact Kenyan-shilling price stored for that course. Lifetime access to that course activates only after Safaricom confirms payment."],
  ["Is there a Premium subscription?", "Not anymore. Premium courses are purchased independently, so there is no monthly or annual renewal. If you bought an all-access subscription under the former model, it remains honoured until its original expiry date; your account and progress are preserved afterwards."],
  ["How long do I keep a purchased course?", "Purchased premium courses give lifetime access on your account while your account remains in good standing and the course remains available on the platform."],
  ["Who sets a course's price?", "Only the course's tutor or the super admin can set its price, and they do so before publication. Current premium courses use a KSh 350–500 transaction-price band and display the live USD equivalent to learners. Regular administrators review content but cannot change pricing."],
  ["Are certificates genuine?", "Certificates require full lesson completion and passing assessments. Each carries a unique code verifiable on our public verification page."],
  ["How do tutors get paid?", "When Safaricom confirms a course payment, the tutor's configured share of that individual sale (80% by default) is credited once to their wallet. Tutors then request withdrawals to M-Pesa or bank; payouts are reviewed and recorded with transaction references."],
  ["Can I learn on my phone?", "Absolutely — Elimu Bora is mobile-first and designed to remain usable on slower connections."],
  ["How do I become a tutor?", "Apply via the Tutor option. Verification is required before you can publish, price or earn from courses."],
];
export default function Faq() {
  return <StaticPage eyebrow="Help" title="Frequently Asked Questions">
    {QA.map(([q, a]) => <div key={q}><H>{q}</H><P>{a}</P></div>)}
  </StaticPage>;
}

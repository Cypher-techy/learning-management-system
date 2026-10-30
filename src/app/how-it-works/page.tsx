import StaticPage, { H, P, UL } from "@/components/StaticPage";
export const metadata = { title: "How EDVORA Works" };
export default function How() {
  return <StaticPage eyebrow="Guide" title="How EDVORA Works" intro="Three account types, one learning platform.">
    <H>For students</H><UL items={["Choose 'Student' and register with your name, email and phone.", "Confirm the verification code — your account is verified immediately.", "Enrol in free courses right away, or preview premium courses.", "Subscribe with M-Pesa to unlock every premium course at once.", "Complete lessons, pass quizzes, submit assignments and earn a verifiable certificate."]} />
    <H>For teachers & lecturers</H><UL items={["Choose 'Teacher / Lecturer' and submit an application with your credentials.", "Our administrators review and verify your application.", "Create courses with sections, video lessons, documents, quizzes and assignments.", "Submit for moderation, then publish. Choose free or premium per course.", "Earn monthly from the teacher revenue pool, allocated by genuine premium engagement, and withdraw via M-Pesa or bank."]} />
    <H>For administrators</H><P>Administrator access is controlled and approved through EDVORA's internal appointment process. Administrators verify teachers, moderate courses, manage subscriptions and payouts, and keep the community safe — every sensitive action is audit-logged.</P>
    <H>Payments & renewals</H><P>Premium is paid via M-Pesa STK Push. Access activates only after Safaricom confirms your payment. There are no automatic charges: we remind you before expiry and you renew with a fresh STK Push. Your progress is preserved even if your subscription lapses.</P>
  </StaticPage>;
}

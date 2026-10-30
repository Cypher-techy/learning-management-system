import StaticPage, { H, P, UL } from "@/components/StaticPage";
export const metadata = { title: "Privacy Policy" };
export default function Privacy() {
  return <StaticPage eyebrow="Legal" title="Privacy Policy" intro="How EDVORA handles your personal data, in line with the Kenya Data Protection Act.">
    <H>Data we collect</H><UL items={["Account details: name, email, phone number and account type.", "Learning activity: enrolments, progress, quiz attempts, submissions and certificates.", "Tutor applications: qualifications and credentials you provide for verification.", "Payment records: M-Pesa transaction references and amounts (we never receive your M-Pesa PIN)."]} />
    <H>How we use it</H><UL items={["To provide learning, verification, payments and support.", "To allocate tutor revenue using aggregated engagement measures.", "To secure the platform and prevent fraud and abuse.", "To send service notifications you can control in Settings."]} />
    <H>Sharing</H><P>We do not sell personal data. Tutors see activity within their own courses only. Payment processing is handled by Safaricom Daraja. We may disclose data where required by Kenyan law.</P>
    <H>Your rights</H><P>You may access, correct or request deletion of your personal data, subject to records we must retain for financial and certificate-verification integrity. Contact support@edvora.ac.ke.</P>
    <H>Security</H><P>Passwords are hashed with strong one-way algorithms, sessions use signed HTTP-only cookies, and all sensitive operations are authorized server-side and audit-logged.</P>
  </StaticPage>;
}

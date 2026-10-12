import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose-page";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const platform = await getPlatform();
  const operator = platform.organizationName;
  return (
    <ProsePage title="Privacy policy" updated="October 2026">
      <p>
        This policy explains what personal information {platform.platformName} collects, why, and the choices you have.
        The platform is operated by {operator} (&quot;we&quot;).
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address and a securely hashed password. Optional profile
          details you choose to add, such as a headline, biography, phone number and country.
        </li>
        <li>
          <strong>Learning records:</strong> enrollments, lesson progress, bookmarks, private notes, assessment
          answers, assignment submissions, grades, feedback and certificates.
        </li>
        <li>
          <strong>Communications:</strong> discussion posts, support requests and the notifications we send you.
        </li>
        <li>
          <strong>Payments:</strong> for paid courses, the amount, status, provider reference and the phone number used
          to pay. We do not store card numbers or mobile-money PINs.
        </li>
        <li>
          <strong>Technical data:</strong> session identifiers, IP address and browser type, used to keep your account
          secure and to investigate abuse.
        </li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To provide courses, record progress, mark work and issue certificates.</li>
        <li>To send service messages such as grade releases, deadlines and security notices.</li>
        <li>To prevent fraud, enforce examination rules and protect accounts.</li>
        <li>To produce aggregate statistics about course activity. These do not identify individual learners.</li>
      </ul>
      <p>We do not sell personal information and we do not use third-party advertising trackers.</p>
      <h2>Who can see your information</h2>
      <ul>
        <li>Instructors can see the progress, submissions and grades of learners in the courses they teach.</li>
        <li>Administrators can access account and learning records to operate and support the platform.</li>
        <li>Other learners see only your name next to discussion posts you write.</li>
        <li>
          Anyone who has a certificate number can confirm the learner name, course title, issue date and status of that
          certificate.
        </li>
        <li>
          Service providers that host the platform, store files, deliver email or process payments handle data on our
          behalf.
        </li>
      </ul>
      <h2>Cookies</h2>
      <p>
        We use a small number of essential cookies to keep you signed in and to remember your light or dark theme. They
        are not used for advertising.
      </p>
      <h2>Retention</h2>
      <p>
        Account and learning records are kept while your account is active. Grade, certificate and payment records may
        be retained after an account is closed where needed to verify certificates or meet legal and accounting
        obligations.
      </p>
      <h2>Your choices and rights</h2>
      <ul>
        <li>You can view and correct your profile from your account settings.</li>
        <li>You can choose which notifications you receive. Security notices cannot be switched off.</li>
        <li>
          You can ask for your account to be deleted from your account settings. Your personal profile data is then
          removed and the account is anonymised.
        </li>
        <li>
          Depending on where you live, including under the Kenya Data Protection Act, 2019, you may have further rights
          to access, object to or restrict the processing of your data.
        </li>
      </ul>
      <h2>Contact</h2>
      <p>
        For privacy questions or requests, use the <Link href="/contact">contact page</Link>
        {platform.supportEmail ? ` or email ${platform.supportEmail}` : ""}.
      </p>
    </ProsePage>
  );
}

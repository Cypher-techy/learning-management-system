import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose-page";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Terms of service" };

export default async function TermsPage() {
  const platform = await getPlatform();
  return (
    <ProsePage title="Terms of service" updated="October 2026">
      <p>
        These terms govern your use of {platform.platformName}, operated by {platform.organizationName}. By creating an
        account or using the platform you agree to them.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>Provide accurate information and keep your password confidential.</li>
        <li>You are responsible for activity on your account. Tell us promptly if you suspect unauthorised use.</li>
        <li>One person per account. Accounts may not be shared or transferred.</li>
      </ul>
      <h2>Courses and access</h2>
      <ul>
        <li>Enrolling gives you a personal, non-transferable right to access that course for your own learning.</li>
        <li>
          Course materials belong to their authors or to the platform. Do not copy, redistribute or resell them without
          permission.
        </li>
        <li>Courses may be updated, unpublished or archived. We will try to give reasonable notice of major changes.</li>
      </ul>
      <h2>Academic integrity</h2>
      <ul>
        <li>Work you submit must be your own unless the task explicitly allows collaboration.</li>
        <li>
          Do not share examination questions or answers, impersonate another learner, or attempt to interfere with
          timers, attempt limits or marking.
        </li>
        <li>
          Examinations are time-limited and recorded. The platform applies proportionate integrity controls, but no
          online system can prevent every form of cheating; results may be reviewed and withdrawn where misconduct is
          established.
        </li>
      </ul>
      <h2>Certificates</h2>
      <p>
        Certificates are issued when a course&apos;s completion requirements are met. They may be revoked if they were
        issued in error or obtained through misconduct. Revoked certificates show as revoked on the verification page.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not post unlawful, abusive or misleading content, upload malicious files, attempt to access data that is not
        yours, or disrupt the service. We may remove content and suspend accounts that break these rules.
      </p>
      <h2>Payments and refunds</h2>
      <p>
        Prices are shown before purchase. Access to a paid course starts once the payment has been confirmed by the
        payment provider. Refunds are handled under the <Link href="/refund-policy">refund policy</Link>.
      </p>
      <h2>Availability and liability</h2>
      <p>
        We work to keep the platform available and accurate but provide it without guarantees of uninterrupted
        service. To the extent permitted by law, our liability is limited to the amount you paid for the course
        concerned.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms. Significant changes will be announced on the platform. Continuing to use the
        platform after a change means you accept the updated terms.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent through the <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}

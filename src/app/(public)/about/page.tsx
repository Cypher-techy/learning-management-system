import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose-page";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const platform = await getPlatform();
  return (
    <ProsePage title={`About ${platform.platformName}`}>
      <p>
        {platform.platformName} is an online learning platform operated by {platform.organizationName}. It brings
        together structured courses, assessment and certification in one place, so that learners can build skills and
        show evidence of what they have achieved.
      </p>
      <h2>What the platform offers</h2>
      <ul>
        <li>Courses organised into modules and lessons, with text, video and downloadable resources.</li>
        <li>Quizzes and examinations with automatic marking, and assignments marked by instructors.</li>
        <li>Progress tracking that is saved to your account and available on any device.</li>
        <li>Certificates of completion, each with a unique number that anyone can verify on this site.</li>
        <li>Course discussions, announcements and scheduled live sessions.</li>
      </ul>
      <h2>Who it is for</h2>
      <p>
        Individual learners, training organisations and institutions that need a dependable way to deliver courses and
        record results. Instructors apply to teach and are approved by the platform administrators before they can
        publish.
      </p>
      <h2>Get in touch</h2>
      <p>
        Questions about a course, your account or teaching on the platform are welcome on the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
    </ProsePage>
  );
}

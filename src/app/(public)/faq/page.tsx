import type { Metadata } from "next";
import Link from "next/link";
import { getPaymentStatus } from "@/server/payments/providers";

export const metadata: Metadata = { title: "Frequently asked questions" };

export default function FaqPage() {
  const payments = getPaymentStatus();
  const faqs: Array<{ q: string; a: React.ReactNode }> = [
    {
      q: "How do I start a course?",
      a: "Create an account, open the course page and choose Enroll. The course then appears under My courses on your dashboard.",
    },
    {
      q: "Are the courses free?",
      a: payments.enabled
        ? "Some courses are free and some are paid. The price is always shown on the course page before you enroll."
        : "Free courses can be started straight away. Online payment for paid courses is not enabled yet; contact us if you would like access to a paid course.",
    },
    {
      q: "How is my progress saved?",
      a: "Progress is stored on your account, not on your device. When you mark a lesson complete it stays complete wherever you sign in. Simply opening a lesson does not count as completing it.",
    },
    {
      q: "What happens if my connection drops during an examination?",
      a: "Your answers are saved as you work. If you are disconnected, sign in again and reopen the examination to continue with your saved answers. The timer keeps running while you are away, and when time is up your saved answers are submitted automatically.",
    },
    {
      q: "When do I see my grades?",
      a: "Automatically marked quizzes usually show results immediately. Essays, uploaded work and assignments are marked by your instructor, and some examinations release results only once the instructor publishes them. You will get a notification when a grade is available.",
    },
    {
      q: "How do I get a certificate?",
      a: "A certificate is issued automatically when you meet all of a course's completion requirements, which may include finishing every lesson and passing required assessments and assignments. You can download it as a PDF from your Certificates page.",
    },
    {
      q: "How can someone check that my certificate is genuine?",
      a: (
        <>
          Every certificate has a unique number. Anyone can enter it on the{" "}
          <Link href="/verify" className="text-primary hover:underline">
            certificate verification page
          </Link>{" "}
          to confirm the learner name, course and current status.
        </>
      ),
    },
    {
      q: "Can I teach on the platform?",
      a: (
        <>
          Yes. Submit an application on the{" "}
          <Link href="/teach" className="text-primary hover:underline">
            Teach a course
          </Link>{" "}
          page. Administrators review each application before instructor access is granted.
        </>
      ),
    },
    {
      q: "I forgot my password. What should I do?",
      a: (
        <>
          Use{" "}
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot password
          </Link>{" "}
          on the sign-in page. We email you a link that works once and expires after one hour.
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Frequently asked questions</h1>
      <div className="mt-6 divide-y rounded-xl border bg-card">
        {faqs.map((item) => (
          <details key={item.q} className="group px-4 py-3">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="mr-2 inline-block text-muted-foreground transition-transform group-open:rotate-90" aria-hidden>
                &rsaquo;
              </span>
              {item.q}
            </summary>
            <div className="mt-2 pl-5 text-sm leading-6 text-muted-foreground">{item.a}</div>
          </details>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Still need help?{" "}
        <Link href="/contact" className="text-primary hover:underline">
          Contact support
        </Link>
        .
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { applyToTeachAction } from "@/app/actions/learner";
import { ActionForm, FormMessage, SubmitButton, TextAreaField } from "@/components/kit/form";
import { LinkButton, StatusBadge } from "@/components/kit/primitives";
import { formatDate } from "@/lib/format";
import { getActor } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { can } from "@/server/permissions";
import { getPlatform } from "@/server/queries/context";

export const metadata: Metadata = { title: "Teach a course" };

export default async function TeachPage() {
  const [platform, actor] = await Promise.all([getPlatform(), getActor()]);
  const [latest] = actor
    ? await db
        .select()
        .from(schema.instructorApplications)
        .where(eq(schema.instructorApplications.userId, actor.id))
        .orderBy(desc(schema.instructorApplications.createdAt))
        .limit(1)
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Teach on {platform.platformName}</h1>
      <p className="mt-2 text-muted-foreground">
        Instructors build courses from modules and lessons, set quizzes, examinations and assignments, mark learners&apos;
        work and follow their progress. Every instructor is approved by an administrator before publishing.
      </p>

      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Apply", "Tell us about your subject expertise and what you would like to teach."],
          ["Get approved", "An administrator reviews your application and notifies you of the outcome."],
          ["Build and publish", "Create your course, then submit it for review and publication."],
        ].map(([title, text], index) => (
          <li key={title} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">Step {index + 1}</p>
            <p className="mt-1 font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-xl border bg-card p-5" aria-labelledby="apply-heading">
        <h2 id="apply-heading" className="text-lg font-semibold">
          Instructor application
        </h2>
        {!actor ? (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Sign in or create an account to apply.</p>
            <div className="mt-3 flex gap-2">
              <LinkButton href="/sign-in?next=/teach">Sign in</LinkButton>
              {platform.registrationEnabled && (
                <LinkButton href="/register?next=/teach" variant="outline">
                  Create an account
                </LinkButton>
              )}
            </div>
          </div>
        ) : can(actor, "course.create") ? (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Your account already has instructor access.</p>
            <LinkButton href="/instructor" className="mt-3">
              Open the instructor dashboard
            </LinkButton>
          </div>
        ) : latest?.status === "pending" ? (
          <div className="mt-3 text-sm">
            <StatusBadge status="pending" label="Under review" />
            <p className="mt-2 text-muted-foreground">
              You applied on {formatDate(latest.createdAt)}. We will notify you when a decision is made.
            </p>
          </div>
        ) : (
          <>
            {latest?.status === "rejected" && (
              <p className="mt-3 rounded-lg border bg-muted px-3 py-2 text-sm">
                Your previous application was not approved{latest.reviewNote ? `: ${latest.reviewNote}` : "."} You are
                welcome to apply again.
              </p>
            )}
            <ActionForm action={applyToTeachAction} className="mt-4 grid gap-4">
              <FormMessage />
              <TextAreaField
                label="Your subject expertise"
                name="expertise"
                rows={3}
                required
                maxLength={1000}
                hint="Qualifications, professional experience or teaching background."
              />
              <TextAreaField
                label="What would you like to teach?"
                name="motivation"
                rows={4}
                required
                maxLength={2000}
                hint="Describe the course or courses you have in mind and who they are for."
              />
              <div>
                <SubmitButton pendingLabel="Sending...">Submit application</SubmitButton>
              </div>
            </ActionForm>
          </>
        )}
      </section>
    </div>
  );
}

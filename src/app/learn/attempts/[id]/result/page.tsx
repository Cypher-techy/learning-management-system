import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { LinkButton, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getAttemptResult } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Assessment result" };

export default async function AttemptResultPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requireActor(`/learn/attempts/${id}/result`);
  const data = await load(() => getAttemptResult(actor, id));
  if (data.attempt.status === "in_progress") redirect(`/learn/attempts/${id}`);

  const header = (
    <PageHeader
      title={data.assessment.title}
      description={`${titleCase(data.assessment.kind)} · Attempt ${data.attempt.attemptNumber}`}
      back={{ href: `/learn/assessments/${data.assessment.id}`, label: "Back to assessment" }}
      actions={
        <LinkButton href={`/learn/courses/${data.course.slug}`} variant="outline">
          Return to course
        </LinkButton>
      }
    />
  );

  if (!data.released) {
    return (
      <>
        {header}
        <div className="rounded-xl border bg-card p-6 text-center">
          <Clock className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold">Your answers were submitted</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {data.attempt.status === "submitted"
              ? "Some answers need to be marked by your instructor. You will be notified when your result is ready."
              : "Results for this assessment are released by the instructor. You will be notified when they are available."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Submitted <LocalTime value={data.attempt.submittedAt} />
            {data.attempt.autoSubmitted ? " (submitted automatically when time ran out)" : ""}
          </p>
        </div>
      </>
    );
  }

  const { attempt } = data;
  return (
    <>
      {header}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Summary label="Result">
          <StatusBadge status={attempt.passed ? "passed" : "failed"} label={attempt.passed ? "Passed" : "Not passed"} />
        </Summary>
        <Summary label="Score">
          {attempt.score} / {attempt.maxScore}
        </Summary>
        <Summary label="Percentage">{attempt.percent}%</Summary>
        <Summary label="Pass mark">{data.assessment.passMarkPercent}%</Summary>
      </div>
      {attempt.autoSubmitted && (
        <p className="mb-6 rounded-lg border bg-muted px-3 py-2 text-sm">
          This attempt was submitted automatically when the time ran out.
        </p>
      )}
      {attempt.feedback && (
        <Section title="Instructor feedback" className="mb-6">
          <p className="text-sm whitespace-pre-line">{attempt.feedback}</p>
        </Section>
      )}

      <Section
        title="Your answers"
        description={
          data.assessment.showCorrectAnswers ? undefined : "Correct answers are not shown for this assessment."
        }
      >
        <ol className="space-y-5">
          {data.review.map((q, index) => (
            <li key={q.id} className="border-b pb-5 last:border-b-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium whitespace-pre-line">
                  <span className="text-muted-foreground">{index + 1}. </span>
                  {q.text}
                </p>
                <span className="shrink-0 text-sm tabular-nums">
                  {q.awardedMarks} / {q.marks}
                </span>
              </div>
              {q.options.length > 0 && (
                <ul className="mt-2 grid gap-1.5">
                  {q.options.map((option) => {
                    const chosen = q.selectedOptionIds.includes(option.id);
                    return (
                      <li
                        key={option.id}
                        className={cn(
                          "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                          option.isCorrect === true && "border-success/40 bg-success/5",
                          chosen && option.isCorrect === false && "border-destructive/40 bg-destructive/5",
                        )}
                      >
                        <span className="mt-0.5 w-4 shrink-0">
                          {option.isCorrect === true ? (
                            <Check className="size-4 text-success" aria-label="Correct answer" />
                          ) : chosen && option.isCorrect === false ? (
                            <X className="size-4 text-destructive" aria-label="Incorrect" />
                          ) : null}
                        </span>
                        <span className="flex-1">{option.text}</span>
                        {chosen && <span className="shrink-0 text-xs text-muted-foreground">Your answer</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
              {(q.type === "short_answer" || q.type === "essay") && (
                <div className="mt-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
                  {q.textAnswer?.trim() ? q.textAnswer : <span className="text-muted-foreground">No answer given.</span>}
                </div>
              )}
              {q.type === "file_upload" && (
                <p className="mt-2 text-sm">
                  {q.fileId ? (
                    <a href={`/api/files/${q.fileId}?download=1`} className="text-primary hover:underline">
                      Download your submitted file
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No file submitted.</span>
                  )}
                </p>
              )}
              {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">Accepted: {q.acceptedAnswers.join(", ")}</p>
              )}
              {q.explanation && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Explanation: </span>
                  {q.explanation}
                </p>
              )}
              {q.feedback && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Feedback: </span>
                  {q.feedback}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 text-xl font-semibold tabular-nums">{children}</div>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, X } from "lucide-react";
import { gradeAttemptAction } from "@/app/actions/instructor";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getAttemptForGrading } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Grade attempt" };

export default async function GradeAttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("grading.manage");
  const { attempt, assessment, learner, items } = await load(() => getAttemptForGrading(actor, id));
  if (attempt.status === "in_progress") redirect(`/instructor/assessments/${assessment.id}/attempts`);
  const manual = items.filter((i) => i.answer?.needsManualGrading);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${learner.name}: ${assessment.title}`}
        description={
          <>
            Attempt {attempt.attemptNumber} · submitted <LocalTime value={attempt.submittedAt} />
            {attempt.autoSubmitted ? " (automatically, when time ran out)" : ""}
          </>
        }
        back={{ href: `/instructor/assessments/${assessment.id}/attempts`, label: "All attempts" }}
        actions={<StatusBadge status={attempt.status} label={attempt.status === "submitted" ? "Needs grading" : undefined} />}
      />
      {attempt.status === "graded" && (
        <p className="mb-6 rounded-lg border bg-muted px-3 py-2 text-sm">
          Score: {attempt.score} / {attempt.maxScore} ({attempt.percent}%) ·{" "}
          {attempt.releasedAt ? "results released to the learner" : "results held until you release them"}
        </p>
      )}
      <ActionForm action={gradeAttemptAction} className="space-y-6">
        <input type="hidden" name="attemptId" value={id} />
        <ol className="space-y-4">
          {items.map(({ question, answer }, index) => {
            const needsMark = !!answer?.needsManualGrading;
            return (
              <li key={question.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium whitespace-pre-line">
                    <span className="text-muted-foreground">{index + 1}. </span>
                    {question.text}
                  </p>
                  <span className="shrink-0 text-sm tabular-nums">
                    {needsMark ? `out of ${question.marks}` : `${answer?.awardedMarks ?? 0} / ${question.marks}`}
                  </span>
                </div>
                {question.options.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {question.options.map((o) => {
                      const chosen = answer?.selectedOptionIds.includes(o.id);
                      return (
                        <li key={o.id} className="flex items-start gap-2">
                          <span className="mt-0.5 w-4 shrink-0">
                            {o.isCorrect ? (
                              <Check className="size-4 text-success" aria-label="Correct answer" />
                            ) : chosen ? (
                              <X className="size-4 text-destructive" aria-label="Incorrect" />
                            ) : null}
                          </span>
                          <span className={chosen ? "font-medium" : "text-muted-foreground"}>
                            {o.text}
                            {chosen ? " (chosen)" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(question.type === "short_answer" || question.type === "essay") && (
                  <div className="mt-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
                    {answer?.textAnswer?.trim() ? answer.textAnswer : <span className="text-muted-foreground">No answer given.</span>}
                  </div>
                )}
                {question.type === "file_upload" && (
                  <p className="mt-2 text-sm">
                    {answer?.fileId ? (
                      <a href={`/api/files/${answer.fileId}?download=1`} className="text-primary hover:underline">
                        Download the submitted file
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No file submitted.</span>
                    )}
                  </p>
                )}
                {needsMark && (
                  <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[8rem_1fr]">
                    <input type="hidden" name="questionIds" value={question.id} />
                    <TextField
                      label="Marks"
                      name={`marks:${question.id}`}
                      type="number"
                      min={0}
                      max={question.marks}
                      step="0.25"
                      defaultValue={answer?.awardedMarks ?? ""}
                      required
                    />
                    <TextAreaField label="Feedback on this answer" name={`feedback:${question.id}`} rows={2} defaultValue={answer?.feedback ?? ""} maxLength={5000} />
                  </div>
                )}
                {!needsMark && answer?.feedback && <p className="mt-2 text-sm text-muted-foreground">Feedback: {answer.feedback}</p>}
              </li>
            );
          })}
        </ol>

        {manual.length > 0 ? (
          <Section title="Finalise grade">
            <div className="grid gap-4">
              <TextAreaField label="Overall feedback" name="feedback" rows={3} defaultValue={attempt.feedback ?? ""} maxLength={10000} />
              <FormMessage />
              <div className="flex items-center gap-3">
                <SubmitButton pendingLabel="Saving...">{attempt.status === "graded" ? "Update grade" : "Save grade"}</SubmitButton>
                <p className="text-sm text-muted-foreground">
                  {assessment.resultRelease === "immediate"
                    ? "The learner is notified as soon as you save."
                    : "Results stay hidden until you release them from the attempts list."}
                </p>
              </div>
            </div>
          </Section>
        ) : (
          <p className="text-sm text-muted-foreground">Every question in this attempt was marked automatically.</p>
        )}
      </ActionForm>
    </div>
  );
}

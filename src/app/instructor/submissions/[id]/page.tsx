import type { Metadata } from "next";
import { Paperclip } from "lucide-react";
import { gradeSubmissionAction } from "@/app/actions/instructor";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { formatBytes } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getSubmissionForGrading } from "@/server/services/assignments";

export const metadata: Metadata = { title: "Grade submission" };

export default async function GradeSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("grading.manage");
  const { submission, assignment, learner, attachments } = await load(() => getSubmissionForGrading(actor, id));
  const penalty = submission.isLate && assignment.latePolicy === "penalty" ? assignment.latePenaltyPercent : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`${learner.name}: ${assignment.title}`}
        description={
          <>
            Submitted <LocalTime value={submission.submittedAt} />
            {submission.isLate ? " (late)" : ""}
            {submission.submissionCount > 1 ? ` · submission ${submission.submissionCount}` : ""}
          </>
        }
        back={{ href: `/instructor/assignments/${assignment.id}`, label: "All submissions" }}
        actions={<StatusBadge status={submission.status} label={submission.status === "submitted" ? "Needs grading" : undefined} />}
      />
      <div className="space-y-6">
        <Section title="Submitted work">
          {submission.textResponse.trim() ? (
            <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm leading-6 whitespace-pre-line">{submission.textResponse}</div>
          ) : (
            <p className="text-sm text-muted-foreground">No written response.</p>
          )}
          {attachments.length > 0 && (
            <ul className="mt-4 divide-y rounded-lg border">
              {attachments.map((file) => (
                <li key={file.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <a href={`/api/files/${file.id}?download=1`} className="min-w-0 flex-1 truncate text-primary hover:underline">
                    {file.name}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Grade">
          <ActionForm action={gradeSubmissionAction} className="grid gap-4">
            <input type="hidden" name="submissionId" value={id} />
            <TextField
              label={`Marks (out of ${assignment.maxMarks})`}
              name="marks"
              type="number"
              min={0}
              max={assignment.maxMarks}
              step="0.5"
              required
              className="max-w-48"
              defaultValue={submission.marks !== null && penalty === 0 ? submission.marks : ""}
              hint={
                penalty > 0
                  ? `Enter the mark before the late penalty. ${penalty}% is deducted automatically.`
                  : `Pass mark is ${assignment.passMarkPercent}%.`
              }
            />
            <TextAreaField label="Feedback" name="feedback" rows={5} defaultValue={submission.feedback ?? ""} maxLength={10000} />
            <CheckboxField
              label="Release the grade and feedback to the learner now"
              name="release"
              defaultChecked
              hint="Untick to save the grade without showing it yet."
            />
            <FormMessage />
            <div>
              <SubmitButton pendingLabel="Saving...">{submission.status === "graded" ? "Update grade" : "Save grade"}</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </div>
  );
}

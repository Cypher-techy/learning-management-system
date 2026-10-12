import type { Metadata } from "next";
import { saveSubmissionAction } from "@/app/actions/learner";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextAreaField } from "@/components/kit/form";
import { Markdown, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { FileListInput } from "@/components/kit/upload";
import { formatBytes } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getAssignmentForLearner } from "@/server/services/assignments";

export const metadata: Metadata = { title: "Assignment" };

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requireActor(`/learn/assignments/${id}`);
  const data = await load(() => getAssignmentForLearner(actor, id), { forbidden: "/learn/courses" });
  const { assignment, submission } = data;
  const overdue = !!assignment.dueAt && assignment.dueAt < new Date();
  const status = submission?.status ?? "not_started";

  return (
    <>
      <PageHeader
        title={assignment.title}
        description={`Assignment in ${data.course.title}`}
        back={{ href: `/learn/courses/${data.course.slug}`, label: data.course.title }}
        actions={<StatusBadge status={status === "not_started" ? "draft" : status} label={status === "not_started" ? "Not started" : undefined} />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Instructions">
            {assignment.instructions.trim() ? (
              <Markdown>{assignment.instructions}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground">No written instructions were provided.</p>
            )}
          </Section>

          {submission?.status === "graded" && (
            <Section title="Grade and feedback">
              <p className="text-2xl font-semibold tabular-nums">
                {submission.marks} / {assignment.maxMarks}
              </p>
              <p className="text-sm text-muted-foreground">
                Pass mark {assignment.passMarkPercent}%
                {submission.isLate && assignment.latePolicy === "penalty"
                  ? ` · includes a ${assignment.latePenaltyPercent}% late penalty`
                  : ""}
              </p>
              {submission.feedback && <p className="mt-3 text-sm whitespace-pre-line">{submission.feedback}</p>}
            </Section>
          )}

          <Section
            title="Your submission"
            description={
              submission?.submittedAt
                ? undefined
                : data.canEdit
                  ? "Save a draft at any time. Your instructor only sees work you submit."
                  : undefined
            }
          >
            {submission?.submittedAt && (
              <p className="mb-4 text-sm text-muted-foreground">
                Submitted <LocalTime value={submission.submittedAt} />
                {submission.isLate ? " (late)" : ""}
                {submission.submissionCount > 1 ? ` · submitted ${submission.submissionCount} times` : ""}
              </p>
            )}
            {data.canEdit ? (
              <ActionForm action={saveSubmissionAction} className="grid gap-4">
                <input type="hidden" name="assignmentId" value={id} />
                <FormMessage />
                {assignment.allowText && (
                  <TextAreaField
                    label="Written response"
                    name="textResponse"
                    rows={10}
                    defaultValue={submission?.textResponse ?? ""}
                    maxLength={100000}
                  />
                )}
                {assignment.allowFiles && (
                  <FileListInput
                    name="fileIds"
                    purpose="submission"
                    courseId={assignment.courseId}
                    initial={data.attachments}
                    maxFiles={assignment.maxFiles}
                    accept={assignment.allowedExtensions}
                  />
                )}
                {overdue && assignment.latePolicy !== "reject" && (
                  <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
                    The deadline has passed. Your work will be marked as late
                    {assignment.latePolicy === "penalty"
                      ? ` and a ${assignment.latePenaltyPercent}% penalty will apply.`
                      : "."}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <SubmitButton name="intent" value="submit" pendingLabel="Saving...">
                    {submission?.status === "submitted" ? "Resubmit" : "Submit assignment"}
                  </SubmitButton>
                  {submission?.status !== "submitted" && (
                    <SubmitButton name="intent" value="draft" variant="outline" pendingLabel="Saving...">
                      Save draft
                    </SubmitButton>
                  )}
                </div>
              </ActionForm>
            ) : (
              <div className="space-y-4">
                {!submission && (
                  <p className="rounded-lg border bg-muted px-3 py-2 text-sm">
                    The deadline has passed and late submissions are not accepted.
                  </p>
                )}
                {submission?.textResponse.trim() && (
                  <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">
                    {submission.textResponse}
                  </div>
                )}
                {data.attachments.length > 0 && (
                  <ul className="divide-y rounded-lg border">
                    {data.attachments.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <a href={`/api/files/${file.id}?download=1`} className="truncate text-primary hover:underline">
                          {file.name}
                        </a>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {submission?.status === "submitted" && (
                  <p className="text-sm text-muted-foreground">
                    Your work is waiting to be graded. Resubmission is not available for this assignment.
                  </p>
                )}
              </div>
            )}
          </Section>
        </div>

        <aside>
          <Section title="Details">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Due</dt>
              <dd>{assignment.dueAt ? <LocalTime value={assignment.dueAt} /> : "No deadline"}</dd>
              <dt className="text-muted-foreground">Marks</dt>
              <dd>{assignment.maxMarks}</dd>
              <dt className="text-muted-foreground">Pass mark</dt>
              <dd>{assignment.passMarkPercent}%</dd>
              <dt className="text-muted-foreground">Late work</dt>
              <dd>
                {assignment.latePolicy === "reject"
                  ? "Not accepted"
                  : assignment.latePolicy === "penalty"
                    ? `${assignment.latePenaltyPercent}% penalty`
                    : "Accepted"}
              </dd>
              <dt className="text-muted-foreground">Resubmission</dt>
              <dd>{assignment.allowResubmission ? "Allowed until graded" : "Not allowed"}</dd>
              {assignment.allowFiles && (
                <>
                  <dt className="text-muted-foreground">File types</dt>
                  <dd>{assignment.allowedExtensions.length ? assignment.allowedExtensions.join(", ") : "Any permitted type"}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Required</dt>
              <dd>{assignment.requiredForCompletion ? "Yes" : "No"}</dd>
            </dl>
          </Section>
        </aside>
      </div>
    </>
  );
}

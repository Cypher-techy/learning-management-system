import type { Metadata } from "next";
import Link from "next/link";
import { deleteAssignmentAction, publishAssignmentAction, updateAssignmentAction } from "@/app/actions/instructor";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import {
  ActionForm,
  CheckboxField,
  DateTimeFormField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/kit/form";
import { LinkButton, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseLessonOptions } from "@/server/queries/instructor";
import { listSubmissions } from "@/server/services/assignments";

export const metadata: Metadata = { title: "Assignment" };

export default async function AssignmentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("grading.manage");
  const { assignment, course, rows } = await load(() => listSubmissions(actor, id));
  const lessons = await courseLessonOptions(course.id);

  return (
    <>
      <PageHeader
        title={assignment.title}
        description={course.title}
        back={{ href: `/instructor/courses/${course.id}/assignments`, label: "Assignments" }}
        actions={
          <>
            <StatusBadge status={assignment.isPublished ? "published" : "draft"} />
            <LinkButton href={`/api/export/assignment-results?assignmentId=${id}`} variant="outline" prefetch={false}>
              Export CSV
            </LinkButton>
            <ActionButton
              action={publishAssignmentAction}
              fields={{ assignmentId: id, published: assignment.isPublished ? "false" : "true" }}
              variant={assignment.isPublished ? "outline" : "default"}
            >
              {assignment.isPublished ? "Unpublish" : "Publish"}
            </ActionButton>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="min-w-0">
          <Section title="Submissions" description="Drafts are private to the learner and are not listed.">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Learner</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(({ submission, learnerName, learnerEmail }) => (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <p className="font-medium">{learnerName}</p>
                          <p className="text-xs text-muted-foreground">{learnerEmail}</p>
                        </TableCell>
                        <TableCell>
                          <LocalTime value={submission.submittedAt} />
                          {submission.isLate && <p className="text-xs text-warning">Late</p>}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={submission.status}
                            label={
                              submission.status === "submitted"
                                ? "Needs grading"
                                : submission.releasedAt
                                  ? "Graded"
                                  : "Graded (held)"
                            }
                          />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {submission.marks === null ? "-" : `${submission.marks} / ${assignment.maxMarks}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/instructor/submissions/${submission.id}`} className="text-primary hover:underline">
                            {submission.status === "submitted" ? "Grade" : "Review"}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </div>

        <Section title="Settings">
          <ActionForm action={updateAssignmentAction} className="grid gap-4">
            <input type="hidden" name="assignmentId" value={id} />
            <TextField label="Title" name="title" defaultValue={assignment.title} required minLength={3} maxLength={160} />
            <TextAreaField label="Instructions" name="instructions" defaultValue={assignment.instructions} rows={8} maxLength={20000} hint="Markdown is supported." />
            <SelectField
              label="Related lesson"
              name="lessonId"
              defaultValue={assignment.lessonId ?? ""}
              options={[{ value: "", label: "None (course level)" }, ...lessons.map((l) => ({ value: l.id, label: l.title }))]}
            />
            <DateTimeFormField label="Deadline" name="dueAt" defaultValue={assignment.dueAt?.toISOString()} hint="Optional. Shown in your local time zone." />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Maximum marks" name="maxMarks" type="number" min={1} step="0.5" defaultValue={assignment.maxMarks} required />
              <TextField label="Pass mark (%)" name="passMarkPercent" type="number" min={0} max={100} defaultValue={assignment.passMarkPercent} required />
            </div>
            <CheckboxField label="Accept a written response" name="allowText" defaultChecked={assignment.allowText} />
            <CheckboxField label="Accept file uploads" name="allowFiles" defaultChecked={assignment.allowFiles} />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Permitted file types"
                name="allowedExtensions"
                defaultValue={assignment.allowedExtensions.join(", ")}
                placeholder="pdf, docx"
                hint="Empty allows any permitted type."
              />
              <TextField label="Maximum files" name="maxFiles" type="number" min={1} max={10} defaultValue={assignment.maxFiles} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                label="Late submissions"
                name="latePolicy"
                defaultValue={assignment.latePolicy}
                options={[
                  { value: "accept", label: "Accept, marked late" },
                  { value: "penalty", label: "Accept with penalty" },
                  { value: "reject", label: "Do not accept" },
                ]}
              />
              <TextField label="Late penalty (%)" name="latePenaltyPercent" type="number" min={0} max={100} defaultValue={assignment.latePenaltyPercent} />
            </div>
            <CheckboxField
              label="Allow resubmission until graded"
              name="allowResubmission"
              defaultChecked={assignment.allowResubmission}
            />
            <CheckboxField
              label="Required to complete the course"
              name="requiredForCompletion"
              defaultChecked={assignment.requiredForCompletion}
            />
            <FormMessage />
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Saving...">Save settings</SubmitButton>
              {rows.length === 0 && (
                <ConfirmAction
                  action={deleteAssignmentAction}
                  fields={{ assignmentId: id }}
                  title="Delete this assignment?"
                  confirmLabel="Delete"
                  destructive
                  variant="ghost"
                >
                  Delete
                </ConfirmAction>
              )}
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

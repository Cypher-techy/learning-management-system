import type { Metadata } from "next";
import { and, asc, inArray, notInArray } from "drizzle-orm";
import {
  addBankQuestionsAction,
  addQuestionAction,
  deleteAssessmentAction,
  publishAssessmentAction,
  removeQuestionAction,
  updateAssessmentAction,
} from "@/app/actions/instructor";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
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
import { checkboxClass, LinkButton, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { NewQuestionPanel } from "@/components/instructor/question-panels";
import { QuestionView } from "@/components/instructor/question-view";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { load, uuidParam } from "@/server/page";
import { courseLessonOptions } from "@/server/queries/instructor";
import { getAssessmentForEditing, listAccessibleBanks } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Edit assessment" };

export default async function AssessmentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  const { assessment, course, questions, attemptCount } = await load(() => getAssessmentForEditing(actor, id));
  const [lessons, banks] = await Promise.all([courseLessonOptions(course.id), listAccessibleBanks(actor)]);
  const used = questions.map((q) => q.id);
  const bankIds = banks.map((b) => b.id);
  const reusable =
    bankIds.length === 0
      ? []
      : await db
          .select({ id: schema.questions.id, text: schema.questions.text, type: schema.questions.type, marks: schema.questions.marks, bankId: schema.questions.bankId })
          .from(schema.questions)
          .where(
            used.length > 0
              ? and(inArray(schema.questions.bankId, bankIds), notInArray(schema.questions.id, used))
              : inArray(schema.questions.bankId, bankIds),
          )
          .orderBy(asc(schema.questions.createdAt))
          .limit(200);
  const locked = attemptCount > 0;
  const total = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={course.title}
        back={{ href: `/instructor/courses/${course.id}/assessments`, label: "Assessments" }}
        actions={
          <>
            <StatusBadge status={assessment.isPublished ? "published" : "draft"} />
            <LinkButton href={`/instructor/assessments/${id}/attempts`} variant="outline">
              Attempts ({attemptCount})
            </LinkButton>
            <ActionButton
              action={publishAssessmentAction}
              fields={{ assessmentId: id, published: assessment.isPublished ? "false" : "true" }}
              variant={assessment.isPublished ? "outline" : "default"}
            >
              {assessment.isPublished ? "Unpublish" : "Publish"}
            </ActionButton>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Questions" description={`${questions.length} questions, ${total} marks in total`}>
            {locked && (
              <p className="mb-4 rounded-lg border bg-muted px-3 py-2 text-sm">
                Learners have started this assessment, so its questions can no longer be changed.
              </p>
            )}
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions yet. Add at least one before publishing.</p>
            ) : (
              <ol className="divide-y">
                {questions.map((q, index) => (
                  <li key={q.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <QuestionView question={q} index={index} />
                    {!locked && (
                      <ActionButton action={removeQuestionAction} fields={{ assessmentId: id, questionId: q.id }} variant="ghost" size="sm">
                        Remove
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {!locked && (
            <>
              <NewQuestionPanel action={addQuestionAction} fields={{ assessmentId: id }} />
              {reusable.length > 0 && (
                <Section title="Reuse from question banks" description="Questions from banks you can access that are not in this assessment yet.">
                  <ActionForm action={addBankQuestionsAction} className="grid gap-3">
                    <input type="hidden" name="assessmentId" value={id} />
                    <FormMessage />
                    <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                      {reusable.map((q) => (
                        <li key={q.id}>
                          <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                            <input type="checkbox" name="questionIds" value={q.id} className={`${checkboxClass} mt-0.5`} />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2">{q.text}</span>
                              <span className="text-xs text-muted-foreground">
                                {banks.find((b) => b.id === q.bankId)?.title} · {q.marks} marks
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div>
                      <SubmitButton variant="outline" pendingLabel="Adding...">
                        Add selected questions
                      </SubmitButton>
                    </div>
                  </ActionForm>
                </Section>
              )}
            </>
          )}
        </div>

        <Section title="Settings">
          <ActionForm action={updateAssessmentAction} className="grid gap-4">
            <input type="hidden" name="assessmentId" value={id} />
            <TextField label="Title" name="title" defaultValue={assessment.title} required minLength={3} maxLength={160} />
            <SelectField
              label="Type"
              name="kind"
              defaultValue={assessment.kind}
              options={[
                { value: "quiz", label: "Quiz" },
                { value: "exam", label: "Examination" },
              ]}
            />
            <TextAreaField label="Instructions" name="instructions" defaultValue={assessment.instructions} rows={4} maxLength={10000} hint="Markdown is supported." />
            <SelectField
              label="Related lesson"
              name="lessonId"
              defaultValue={assessment.lessonId ?? ""}
              options={[{ value: "", label: "None (course level)" }, ...lessons.map((l) => ({ value: l.id, label: l.title }))]}
            />
            <DateTimeFormField label="Opens" name="startsAt" defaultValue={assessment.startsAt?.toISOString()} hint="Optional. Shown in your local time zone." />
            <DateTimeFormField label="Closes" name="endsAt" defaultValue={assessment.endsAt?.toISOString()} hint="Optional. Attempts are closed automatically at this time." />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Time limit (minutes)" name="timeLimitMinutes" type="number" min={1} max={1440} defaultValue={assessment.timeLimitMinutes ?? ""} hint="Empty for none." />
              <TextField label="Maximum attempts" name="maxAttempts" type="number" min={1} max={50} defaultValue={assessment.maxAttempts} required />
              <TextField label="Pass mark (%)" name="passMarkPercent" type="number" min={0} max={100} defaultValue={assessment.passMarkPercent} required />
              <TextField label="Negative marking (%)" name="negativeMarkingPercent" type="number" min={0} max={100} defaultValue={assessment.negativeMarkingPercent} hint="Deducted per wrong answer." />
            </div>
            <SelectField
              label="Release of results"
              name="resultRelease"
              defaultValue={assessment.resultRelease}
              options={[
                { value: "immediate", label: "As soon as marking is complete" },
                { value: "manual", label: "When I release them" },
              ]}
            />
            <CheckboxField label="Shuffle the order of questions" name="shuffleQuestions" defaultChecked={assessment.shuffleQuestions} />
            <CheckboxField label="Shuffle answer options" name="shuffleOptions" defaultChecked={assessment.shuffleOptions} />
            <CheckboxField
              label="Show correct answers with released results"
              name="showCorrectAnswers"
              defaultChecked={assessment.showCorrectAnswers}
            />
            <CheckboxField
              label="Required to complete the course"
              name="requiredForCompletion"
              defaultChecked={assessment.requiredForCompletion}
            />
            <FormMessage />
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Saving...">Save settings</SubmitButton>
              {!locked && (
                <ConfirmAction
                  action={deleteAssessmentAction}
                  fields={{ assessmentId: id }}
                  title="Delete this assessment?"
                  description="Its questions stay in the question bank."
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

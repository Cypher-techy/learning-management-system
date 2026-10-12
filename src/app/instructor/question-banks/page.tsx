import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { createBankAction } from "@/app/actions/instructor";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { EmptyState, PageHeader, Section } from "@/components/kit/primitives";
import { requirePermission } from "@/server/auth/session";
import { listManagedCourses } from "@/server/queries/instructor";
import { listAccessibleBanks } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Question banks" };

export default async function QuestionBanksPage() {
  const actor = await requirePermission("question_bank.manage");
  const [banks, courses] = await Promise.all([listAccessibleBanks(actor), listManagedCourses(actor, true)]);

  return (
    <>
      <PageHeader
        title="Question banks"
        description="Collections of questions you can reuse across assessments. A bank linked to a course is shared with that course's teaching team."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {banks.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title="No question banks yet"
              description="A bank is created automatically when you write the first question in an assessment, or you can create one here."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {banks.map((bank) => (
                <li key={bank.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/instructor/question-banks/${bank.id}`} className="font-medium hover:underline">
                      {bank.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {bank.courseTitle ? `Shared with ${bank.courseTitle}` : "Personal bank"}
                      {bank.description ? ` · ${bank.description}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {bank.questionCount} {bank.questionCount === 1 ? "question" : "questions"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Section title="New question bank">
          <ActionForm action={createBankAction} className="grid gap-4">
            <FormMessage />
            <TextField label="Name" name="title" required minLength={2} maxLength={120} />
            <TextAreaField label="Description" name="description" rows={2} maxLength={500} />
            <SelectField
              label="Share with a course"
              name="courseId"
              options={[{ value: "", label: "Keep personal" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]}
            />
            <div>
              <SubmitButton pendingLabel="Creating...">Create bank</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

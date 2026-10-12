import type { Metadata } from "next";
import { deleteBankAction, deleteQuestionAction, saveBankQuestionAction } from "@/app/actions/instructor";
import { ConfirmAction } from "@/components/kit/confirm";
import { PageHeader, Section } from "@/components/kit/primitives";
import { EditQuestionPanel, NewQuestionPanel } from "@/components/instructor/question-panels";
import { QuestionView } from "@/components/instructor/question-view";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getBankWithQuestions } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionBankPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("question_bank.manage");
  const { bank, questions } = await load(() => getBankWithQuestions(actor, id));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={bank.title}
        description={bank.description || undefined}
        back={{ href: "/instructor/question-banks", label: "Question banks" }}
        actions={
          <ConfirmAction
            action={deleteBankAction}
            fields={{ bankId: id }}
            title="Delete this question bank?"
            description="All questions in it are deleted. This is refused while any of them is used in an assessment."
            confirmLabel="Delete bank"
            destructive
            variant="ghost"
          >
            Delete bank
          </ConfirmAction>
        }
      />
      <div className="space-y-6">
        <NewQuestionPanel action={saveBankQuestionAction} fields={{ bankId: id }} />
        <Section title={`Questions (${questions.length})`}>
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">This bank is empty.</p>
          ) : (
            <ol className="divide-y">
              {questions.map((q, index) => (
                <li key={q.id} className="flex flex-wrap items-start gap-2 py-4 first:pt-0 last:pb-0">
                  <QuestionView question={q} index={index} />
                  <EditQuestionPanel
                    action={saveBankQuestionAction}
                    fields={{ bankId: id }}
                    question={{
                      id: q.id,
                      type: q.type,
                      text: q.text,
                      marks: q.marks,
                      explanation: q.explanation,
                      acceptedAnswers: q.acceptedAnswers,
                      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                    }}
                  />
                  <ConfirmAction
                    action={deleteQuestionAction}
                    fields={{ questionId: q.id }}
                    title="Delete this question?"
                    confirmLabel="Delete"
                    destructive
                    variant="ghost"
                    size="sm"
                  >
                    Delete
                  </ConfirmAction>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </div>
  );
}

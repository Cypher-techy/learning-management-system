import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/kit/primitives";
import { ExamRunner } from "@/components/learn/exam-runner";
import { titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getAttemptForTaking } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Assessment in progress" };

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requireActor(`/learn/attempts/${id}`);
  // Loads only this learner's own attempt, and never includes correct answers.
  const data = await load(() => getAttemptForTaking(actor, id));
  if (data.attempt.status !== "in_progress") redirect(`/learn/attempts/${id}/result`);

  return (
    <>
      <PageHeader
        title={data.assessment.title}
        description={`${titleCase(data.assessment.kind)} · Attempt ${data.attempt.attemptNumber} of ${data.assessment.maxAttempts}`}
      />
      <ExamRunner
        attemptId={id}
        courseId={data.assessment.courseId}
        questions={data.questions}
        initialAnswers={data.answers}
        deadlineAt={data.attempt.deadlineAt?.toISOString() ?? null}
        serverNow={new Date().toISOString()}
      />
    </>
  );
}

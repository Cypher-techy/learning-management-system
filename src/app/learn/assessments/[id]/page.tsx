import type { Metadata } from "next";
import Link from "next/link";
import { startAttemptAction } from "@/app/actions/learner";
import { ActionButton } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { LinkButton, Markdown, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getAssessmentOverview } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Assessment" };

const BLOCKED: Record<string, string> = {
  not_open: "This assessment has not opened yet.",
  closed: "This assessment has closed.",
  no_attempts_left: "You have used all of your attempts.",
};

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requireActor(`/learn/assessments/${id}`);
  const data = await load(() => getAssessmentOverview(actor, id), { forbidden: "/learn/courses" });
  const { assessment } = data;
  const attemptsLeft = Math.max(0, assessment.maxAttempts - data.attempts.length);

  return (
    <>
      <PageHeader
        title={assessment.title}
        description={`${titleCase(assessment.kind)} in ${data.course.title}`}
        back={{ href: `/learn/courses/${data.course.slug}`, label: data.course.title }}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          {assessment.instructions.trim() !== "" && (
            <Section title="Instructions">
              <Markdown>{assessment.instructions}</Markdown>
            </Section>
          )}

          <Section title="Examination rules">
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              <li>Your answers are saved automatically as you work.</li>
              {assessment.timeLimitMinutes ? (
                <li>
                  The timer starts when you begin and keeps running on the server, even if you close the page or lose
                  your connection. You can return and continue until time runs out.
                </li>
              ) : (
                <li>There is no time limit, but the assessment closes at the closing time shown.</li>
              )}
              <li>When time is up, the answers saved so far are submitted automatically.</li>
              <li>Answers cannot be changed after you submit.</li>
              {assessment.negativeMarkingPercent > 0 && (
                <li>
                  Wrong answers to objective questions lose {assessment.negativeMarkingPercent}% of that question&apos;s
                  marks. Unanswered questions score zero.
                </li>
              )}
              {(assessment.shuffleQuestions || assessment.shuffleOptions) && (
                <li>Questions or answer options are presented in a different order for each learner.</li>
              )}
              <li>The work you submit must be your own. Attempt times and submissions are recorded.</li>
            </ul>
          </Section>

          <Section title="Your attempts">
            {data.attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">You have not attempted this assessment yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>{attempt.attemptNumber}</TableCell>
                        <TableCell>
                          <LocalTime value={attempt.startedAt} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={attempt.status}
                            label={
                              attempt.status === "in_progress"
                                ? "In progress"
                                : attempt.released
                                  ? attempt.passed
                                    ? "Passed"
                                    : "Not passed"
                                  : "Awaiting results"
                            }
                          />
                        </TableCell>
                        <TableCell>{attempt.percent === null ? "-" : `${attempt.percent}%`}</TableCell>
                        <TableCell className="text-right">
                          {attempt.status === "in_progress" ? (
                            <Link href={`/learn/attempts/${attempt.id}`} className="text-primary hover:underline">
                              Resume
                            </Link>
                          ) : (
                            <Link href={`/learn/attempts/${attempt.id}/result`} className="text-primary hover:underline">
                              View
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </div>

        <aside>
          <Section title="Summary">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Questions</dt>
              <dd>{data.questionCount}</dd>
              <dt className="text-muted-foreground">Total marks</dt>
              <dd>{data.totalMarks}</dd>
              <dt className="text-muted-foreground">Pass mark</dt>
              <dd>{assessment.passMarkPercent}%</dd>
              <dt className="text-muted-foreground">Time limit</dt>
              <dd>{assessment.timeLimitMinutes ? `${assessment.timeLimitMinutes} min` : "None"}</dd>
              <dt className="text-muted-foreground">Attempts left</dt>
              <dd>
                {attemptsLeft} of {assessment.maxAttempts}
              </dd>
              {assessment.startsAt && (
                <>
                  <dt className="text-muted-foreground">Opens</dt>
                  <dd>
                    <LocalTime value={assessment.startsAt} />
                  </dd>
                </>
              )}
              {assessment.endsAt && (
                <>
                  <dt className="text-muted-foreground">Closes</dt>
                  <dd>
                    <LocalTime value={assessment.endsAt} />
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Results</dt>
              <dd>{assessment.resultRelease === "immediate" ? "After marking" : "When released by the instructor"}</dd>
            </dl>
            <div className="mt-4">
              {data.inProgress ? (
                <LinkButton href={`/learn/attempts/${data.inProgress.id}`} className="w-full">
                  Resume attempt
                </LinkButton>
              ) : data.blocker ? (
                <p className="rounded-lg border bg-muted px-3 py-2 text-sm">{BLOCKED[data.blocker]}</p>
              ) : data.questionCount === 0 ? (
                <p className="rounded-lg border bg-muted px-3 py-2 text-sm">This assessment has no questions yet.</p>
              ) : (
                <ActionButton action={startAttemptAction} fields={{ assessmentId: id }} variant="default" className="w-full">
                  {data.attempts.length > 0 ? "Start a new attempt" : "Start"}
                </ActionButton>
              )}
            </div>
          </Section>
        </aside>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { releaseResultsAction } from "@/app/actions/instructor";
import { ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { listAttemptsForAssessment } from "@/server/services/assessments";

export const metadata: Metadata = { title: "Attempts" };

export default async function AttemptsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("grading.manage");
  const { assessment, rows } = await load(() => listAttemptsForAssessment(actor, id));
  const held = rows.filter((r) => r.attempt.status === "graded" && !r.attempt.releasedAt).length;

  return (
    <>
      <PageHeader
        title={`Attempts: ${assessment.title}`}
        back={{ href: `/instructor/assessments/${id}`, label: "Assessment" }}
        actions={
          <>
            <LinkButton href={`/api/export/assessment-results?assessmentId=${id}`} variant="outline" prefetch={false}>
              Export CSV
            </LinkButton>
            {held > 0 && (
              <ConfirmAction
                action={releaseResultsAction}
                fields={{ assessmentId: id }}
                title={`Release ${held} result${held === 1 ? "" : "s"}?`}
                description="Learners are notified and can see their scores and feedback. This cannot be undone."
                confirmLabel="Release results"
                variant="default"
              >
                Release held results ({held})
              </ConfirmAction>
            )}
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No attempts yet" description="Attempts appear here as learners take this assessment." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Attempt</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ attempt, learnerName, learnerEmail }) => (
                <TableRow key={attempt.id}>
                  <TableCell>
                    <p className="font-medium">{learnerName}</p>
                    <p className="text-xs text-muted-foreground">{learnerEmail}</p>
                  </TableCell>
                  <TableCell>{attempt.attemptNumber}</TableCell>
                  <TableCell>
                    {attempt.submittedAt ? <LocalTime value={attempt.submittedAt} /> : "-"}
                    {attempt.autoSubmitted && <p className="text-xs text-muted-foreground">Auto-submitted</p>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={attempt.status}
                      label={attempt.status === "submitted" ? "Needs grading" : undefined}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {attempt.score === null ? "-" : `${attempt.score} / ${attempt.maxScore} (${attempt.percent}%)`}
                  </TableCell>
                  <TableCell>
                    {attempt.status === "graded" ? (
                      <StatusBadge status={attempt.releasedAt ? "published" : "pending"} label={attempt.releasedAt ? "Released" : "Held"} />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {attempt.status === "in_progress" ? (
                      <span className="text-muted-foreground">-</span>
                    ) : (
                      <Link href={`/instructor/attempts/${attempt.id}`} className="text-primary hover:underline">
                        {attempt.status === "submitted" ? "Grade" : "Review"}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

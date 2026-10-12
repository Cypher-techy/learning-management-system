import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { myGrades } from "@/server/queries/learner";

export const metadata: Metadata = { title: "Grades" };

export default async function GradesPage() {
  const actor = await requireActor("/learn/grades");
  const { attempts, submissions } = await myGrades(actor.id);

  return (
    <>
      <PageHeader
        title="Grades"
        description="Results appear here once they have been marked and released."
      />
      {attempts.length === 0 && submissions.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No grades yet"
          description="When you submit a quiz, examination or assignment it will be listed here."
        />
      ) : (
        <div className="space-y-6">
          <Section title="Quizzes and examinations">
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted attempts yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <Link href={`/learn/attempts/${a.id}/result`} className="font-medium hover:underline">
                            {a.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {titleCase(a.kind)} · Attempt {a.attemptNumber}
                          </p>
                        </TableCell>
                        <TableCell>{a.courseTitle}</TableCell>
                        <TableCell>
                          <LocalTime value={a.submittedAt} />
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {a.released ? `${a.score} / ${a.maxScore} (${a.percent}%)` : "-"}
                        </TableCell>
                        <TableCell>
                          {a.released ? (
                            <StatusBadge status={a.passed ? "passed" : "failed"} label={a.passed ? "Passed" : "Not passed"} />
                          ) : (
                            <StatusBadge status="pending" label="Awaiting results" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>

          <Section title="Assignments">
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submitted assignments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((s) => {
                      const passed = s.released && s.marks !== null && (s.marks / s.maxMarks) * 100 >= s.passMarkPercent;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <Link href={`/learn/assignments/${s.assignmentId}`} className="font-medium hover:underline">
                              {s.title}
                            </Link>
                            {s.isLate && <p className="text-xs text-muted-foreground">Submitted late</p>}
                          </TableCell>
                          <TableCell>{s.courseTitle}</TableCell>
                          <TableCell>
                            <LocalTime value={s.submittedAt} />
                          </TableCell>
                          <TableCell className="tabular-nums">{s.released ? `${s.marks} / ${s.maxMarks}` : "-"}</TableCell>
                          <TableCell>
                            {s.released ? (
                              <StatusBadge status={passed ? "passed" : "failed"} label={passed ? "Passed" : "Not passed"} />
                            ) : (
                              <StatusBadge status="pending" label="Awaiting grade" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createAssessmentAction } from "@/app/actions/instructor";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextField } from "@/components/kit/form";
import { EmptyState, Section, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseAssessmentsList } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "Assessments" };

export default async function CourseAssessmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  const rows = await load(() => courseAssessmentsList(actor, id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No quizzes or examinations yet"
            description="Create one, add questions, then publish it for your learners."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Closes</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/instructor/assessments/${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{titleCase(a.kind)}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.isPublished ? "published" : "draft"} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.questions}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.attempts}</TableCell>
                    <TableCell>{a.endsAt ? <LocalTime value={a.endsAt} /> : "-"}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/instructor/assessments/${a.id}/attempts`} className="text-primary hover:underline">
                        {a.toGrade > 0 ? `${a.toGrade} to grade` : a.held > 0 ? `${a.held} to release` : "View"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Section title="New assessment" description="Starts unpublished.">
        <ActionForm action={createAssessmentAction} className="grid gap-4">
          <input type="hidden" name="courseId" value={id} />
          <FormMessage />
          <TextField label="Title" name="title" required minLength={3} maxLength={160} />
          <SelectField
            label="Type"
            name="kind"
            options={[
              { value: "quiz", label: "Quiz" },
              { value: "exam", label: "Examination" },
            ]}
          />
          <div>
            <SubmitButton pendingLabel="Creating...">Create and add questions</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}

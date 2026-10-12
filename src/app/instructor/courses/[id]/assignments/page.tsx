import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { createAssignmentAction } from "@/app/actions/instructor";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/kit/form";
import { EmptyState, Section, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseAssignmentsList } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "Assignments" };

export default async function CourseAssignmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  const rows = await load(() => courseAssignmentsList(actor, id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0">
        {rows.length === 0 ? (
          <EmptyState icon={FileText} title="No assignments yet" description="Create an assignment for learners to submit written work or files." />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">To grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/instructor/assignments/${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.isPublished ? "published" : "draft"} />
                    </TableCell>
                    <TableCell>{a.dueAt ? <LocalTime value={a.dueAt} /> : "No deadline"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.submitted}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.toGrade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <Section title="New assignment" description="Starts unpublished.">
        <ActionForm action={createAssignmentAction} className="grid gap-4">
          <input type="hidden" name="courseId" value={id} />
          <FormMessage />
          <TextField label="Title" name="title" required minLength={3} maxLength={160} />
          <div>
            <SubmitButton pendingLabel="Creating...">Create and configure</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}

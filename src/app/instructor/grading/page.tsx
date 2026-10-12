import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, PageHeader } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { pendingGrading } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "Grading" };

export default async function GradingPage() {
  const actor = await requirePermission("grading.manage");
  const items = await pendingGrading(actor, 200);

  return (
    <>
      <PageHeader title="Grading" description="Submitted work waiting for your mark, oldest first." />
      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="You are all caught up" description="Nothing is waiting to be graded in the courses you teach." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Learner</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={`${item.kind}-${item.id}`}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.kind === "attempt" ? "Assessment" : "Assignment"}</TableCell>
                  <TableCell>{item.learnerName}</TableCell>
                  <TableCell>{item.courseTitle}</TableCell>
                  <TableCell>
                    <LocalTime value={item.submittedAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={item.href} className="text-primary hover:underline">
                      Grade
                    </Link>
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

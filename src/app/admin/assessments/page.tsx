import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/kit/datetime-field";
import { PageHeader, pageParam, Pagination, StatusBadge, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { assessmentsOversight } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Assessments" };

const PAGE_SIZE = 25;

export default async function AdminAssessmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = pageParam((await searchParams).page);
  const actor = await requirePermission("assessment.oversee");
  const { rows, total } = await assessmentsOversight(actor, { page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader title="Assessments" description="Quizzes and examinations across all courses." />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assessment</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Awaiting grading</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead>Closes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No assessments have been created yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/instructor/assessments/${a.id}/attempts`} className="font-medium hover:underline">
                    {a.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{titleCase(a.kind)}</p>
                </TableCell>
                <TableCell>{a.courseTitle}</TableCell>
                <TableCell>
                  <StatusBadge status={a.isPublished ? "published" : "draft"} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.attempts}</TableCell>
                <TableCell className="text-right tabular-nums">{a.awaiting}</TableCell>
                <TableCell className="text-right tabular-nums">{a.average === null ? "-" : `${a.average}%`}</TableCell>
                <TableCell>{a.endsAt ? <LocalTime value={a.endsAt} /> : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/admin/assessments?page=${p}`} />
    </>
  );
}

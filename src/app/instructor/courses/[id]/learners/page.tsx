import type { Metadata } from "next";
import { Users } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import {
  EmptyState,
  first,
  LinkButton,
  pageParam,
  Pagination,
  ProgressBar,
  StatusBadge,
  withParams,
  type SearchParams,
} from "@/components/kit/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseLearners } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "Learners" };

const PAGE_SIZE = 25;

export default async function CourseLearnersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const id = uuidParam((await params).id);
  const sp = await searchParams;
  const q = first(sp.q);
  const page = pageParam(sp.page);
  const actor = await requirePermission("course.create");
  const { rows, total } = await load(() => courseLearners(actor, id, { q, page, pageSize: PAGE_SIZE }));
  const base = `/instructor/courses/${id}/learners`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 gap-2" role="search">
          <Input name="q" type="search" defaultValue={q ?? ""} placeholder="Search by name or email" aria-label="Search learners" className="max-w-xs" />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <LinkButton href={`/api/export/course-learners?courseId=${id}`} variant="outline" prefetch={false}>
          Export CSV
        </LinkButton>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No learners match your search" : "Nobody is enrolled yet"}
          description={q ? undefined : "Learners appear here once they enroll in this course."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-40">Progress</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.enrollmentId}>
                    <TableCell>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <ProgressBar value={row.status === "completed" ? 100 : row.progressPercent} label={`Progress of ${row.name}`} />
                    </TableCell>
                    <TableCell>
                      <LocalTime value={row.enrolledAt} dateOnly />
                    </TableCell>
                    <TableCell>{row.lastAccessedAt ? <LocalTime value={row.lastAccessedAt} dateOnly /> : "Not yet"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams(base, { q }, { page: p })} />
        </>
      )}
    </>
  );
}

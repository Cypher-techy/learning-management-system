import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { first, PageHeader, pageParam, Pagination, StatusBadge, withParams, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { listAllCourses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Courses" };

const PAGE_SIZE = 25;

export default async function AdminCoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = { q: first(sp.q), status: first(sp.status) };
  const page = pageParam(sp.page);
  const actor = await requirePermission("course.manage_any");
  const { rows, total } = await listAllCourses(actor, { ...filters, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader title="Courses" description="Every course on the platform. Courses awaiting review are listed first." />
      <FilterBar
        q={filters.q}
        placeholder="Search by title or instructor"
        clearHref="/admin/courses"
        selects={[
          {
            name: "status",
            label: "Status",
            value: filters.status,
            options: [
              { value: "", label: "Any status" },
              { value: "pending_review", label: "Awaiting review" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Draft" },
              { value: "unpublished", label: "Unpublished" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
      />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Instructor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Enrolled</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No courses match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((course) => (
              <TableRow key={course.id}>
                <TableCell>
                  <Link href={`/admin/courses/${course.id}`} className="font-medium hover:underline">
                    {course.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{course.categoryName ?? "No category"}</p>
                </TableCell>
                <TableCell>{course.ownerName}</TableCell>
                <TableCell>
                  <StatusBadge status={course.status} label={course.status === "pending_review" ? "Awaiting review" : undefined} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{course.enrolled}</TableCell>
                <TableCell>{formatMoney(course.priceCents, course.currency)}</TableCell>
                <TableCell>
                  <LocalTime value={course.updatedAt} dateOnly />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/courses", filters, { page: p })} />
    </>
  );
}

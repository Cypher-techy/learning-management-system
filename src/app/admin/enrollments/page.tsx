import type { Metadata } from "next";
import { asc, inArray } from "drizzle-orm";
import { enrollmentStatusAction, grantEnrollmentAction } from "@/app/actions/admin";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { FilterBar } from "@/components/kit/filter-bar";
import { ActionForm, FormMessage, SelectField, SubmitButton, TextField } from "@/components/kit/form";
import { first, LinkButton, PageHeader, pageParam, Pagination, Section, StatusBadge, withParams, type SearchParams } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { listEnrollments } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Enrollments" };

const PAGE_SIZE = 25;

export default async function EnrollmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const filters = { q: first(sp.q), status: first(sp.status) };
  const page = pageParam(sp.page);
  const actor = await requirePermission("enrollment.manage");
  const [{ rows, total }, courses] = await Promise.all([
    listEnrollments(actor, { ...filters, page, pageSize: PAGE_SIZE }),
    db
      .select({ id: schema.courses.id, title: schema.courses.title })
      .from(schema.courses)
      .where(inArray(schema.courses.status, ["published", "unpublished"]))
      .orderBy(asc(schema.courses.title))
      .limit(500),
  ]);

  return (
    <>
      <PageHeader title="Enrollments" description={`${total} enrollment ${total === 1 ? "record" : "records"}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <FilterBar
            q={filters.q}
            placeholder="Search learner or course"
            clearHref="/admin/enrollments"
            selects={[
              {
                name: "status",
                label: "Status",
                value: filters.status,
                options: [
                  { value: "", label: "Any status" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "suspended", label: "Suspended" },
                  { value: "cancelled", label: "Cancelled" },
                ],
              },
            ]}
          >
            <LinkButton href="/api/export/enrollments" variant="outline" prefetch={false}>
              Export CSV
            </LinkButton>
          </FilterBar>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Learner</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Progress</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No enrollments match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="font-medium">{e.learnerName}</p>
                      <p className="text-xs text-muted-foreground">{e.learnerEmail}</p>
                    </TableCell>
                    <TableCell>
                      {e.courseTitle}
                      <p className="text-xs text-muted-foreground">{titleCase(e.source)}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.progressPercent}%</TableCell>
                    <TableCell>
                      <LocalTime value={e.enrolledAt} dateOnly />
                    </TableCell>
                    <TableCell className="text-right">
                      {e.status === "active" && (
                        <ConfirmAction
                          action={enrollmentStatusAction}
                          fields={{ enrollmentId: e.id, status: "suspended" }}
                          title="Suspend this enrollment?"
                          description="The learner loses access to the course until it is reactivated. Their progress is kept."
                          confirmLabel="Suspend"
                          variant="ghost"
                          size="sm"
                        >
                          Suspend
                        </ConfirmAction>
                      )}
                      {(e.status === "suspended" || e.status === "cancelled") && (
                        <ActionButton action={enrollmentStatusAction} fields={{ enrollmentId: e.id, status: "active" }} variant="ghost" size="sm">
                          Reactivate
                        </ActionButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams("/admin/enrollments", filters, { page: p })} />
        </div>

        <Section title="Grant access" description="Enroll an existing user in a course without payment.">
          <ActionForm action={grantEnrollmentAction} resetOnSuccess className="grid gap-4">
            <FormMessage />
            <TextField label="User's email address" name="email" type="email" required />
            <SelectField label="Course" name="courseId" required options={[{ value: "", label: "Choose a course" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
            <div>
              <SubmitButton pendingLabel="Granting...">Grant enrollment</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

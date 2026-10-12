import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createCourseAction } from "@/app/actions/instructor";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/kit/form";
import { EmptyState, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { listManagedCourses } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "My courses" };

export default async function InstructorCoursesPage() {
  const actor = await requirePermission("course.create");
  const courses = await listManagedCourses(actor, true);

  return (
    <>
      <PageHeader title="My courses" description="Courses you own or teach." />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Give your course a working title to get started. You can change everything later."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <Link href={`/instructor/courses/${course.id}`} className="font-medium hover:underline">
                          {course.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {course.categoryName ?? "No category"} · {course.lessons} {course.lessons === 1 ? "lesson" : "lessons"}
                        </p>
                        {course.status === "draft" && course.reviewNote && (
                          <p className="mt-1 max-w-sm text-xs text-destructive">Changes requested: {course.reviewNote}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={course.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{course.enrolled}</TableCell>
                      <TableCell className="text-right tabular-nums">{course.completed}</TableCell>
                      <TableCell>{formatMoney(course.priceCents, course.currency)}</TableCell>
                      <TableCell>
                        <LocalTime value={course.updatedAt} dateOnly />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <div id="new" className="scroll-mt-20">
          <Section title="New course" description="Starts as a private draft.">
            <ActionForm action={createCourseAction} className="grid gap-4">
              <FormMessage />
              <TextField label="Course title" name="title" required minLength={4} maxLength={120} />
              <div>
                <SubmitButton pendingLabel="Creating...">Create course</SubmitButton>
              </div>
            </ActionForm>
          </Section>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { SimpleBarChart, SimpleLineChart } from "@/components/kit/charts";
import { LinkButton, Section, StatCard } from "@/components/kit/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePermission } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseAnalytics } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "Course analytics" };

export default async function CourseAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  const data = await load(() => courseAnalytics(actor, id));
  const { summary } = data;
  const rate = summary.total === 0 ? 0 : Math.round((summary.completed / summary.total) * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total enrollments" value={summary.total} />
        <StatCard label="Currently active" value={summary.active} />
        <StatCard label="Completed" value={summary.completed} hint={`${rate}% completion rate`} />
        <StatCard label="Average progress" value={`${summary.averageProgress}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="New enrollments per week" description="Last 12 weeks">
          {data.weekly.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrollments in this period.</p>
          ) : (
            <SimpleLineChart data={data.weekly.map((w) => ({ week: w.week.slice(5), enrollments: w.n }))} x="week" y="enrollments" label="Enrollments" />
          )}
        </Section>
        <Section title="Learner progress" description="Active and completed learners by progress">
          {summary.total === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody is enrolled yet.</p>
          ) : (
            <SimpleBarChart data={data.distribution} x="bucket" y="learners" label="Learners" />
          )}
        </Section>
      </div>

      <Section
        title="Assessment performance"
        actions={
          <LinkButton href={`/api/export/course-learners?courseId=${id}`} variant="outline" size="sm" prefetch={false}>
            Download learner report (CSV)
          </LinkButton>
        }
      >
        {data.assessments.length === 0 && data.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">This course has no assessments or assignments.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Graded</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Pass rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assessments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>Assessment</TableCell>
                    <TableCell className="text-right tabular-nums">{a.attempts}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.average === null ? "-" : `${a.average}%`}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.passRate === null ? "-" : `${a.passRate}%`}</TableCell>
                  </TableRow>
                ))}
                {data.assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>Assignment</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.graded} of {a.submitted}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.average === null ? "-" : `${a.average} / ${a.maxMarks}`}
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ClipboardList, GraduationCap, Percent, Plus } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, LinkButton, PageHeader, ProgressBar, Section, StatCard, StatusBadge } from "@/components/kit/primitives";
import { titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { instructorOverview } from "@/server/queries/instructor";

export const metadata: Metadata = { title: "Instructor overview" };

export default async function InstructorOverviewPage() {
  const actor = await requirePermission("course.create");
  const data = await instructorOverview(actor);

  return (
    <>
      <PageHeader
        title="Instructor overview"
        description="The courses you teach, your learners and the work waiting for you."
        actions={
          <LinkButton href="/instructor/courses#new">
            <Plus aria-hidden /> New course
          </LinkButton>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="My courses" value={data.totals.courses} hint={`${data.totals.published} published`} icon={BookOpen} href="/instructor/courses" />
        <StatCard label="Enrolled learners" value={data.totals.enrolled} icon={GraduationCap} />
        <StatCard label="Completion rate" value={`${data.totals.completionRate}%`} icon={Percent} />
        <StatCard label="Pending grading" value={data.pending.length} icon={ClipboardList} href="/instructor/grading" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="My courses"
          actions={<LinkButton href="/instructor/courses" variant="ghost" size="sm">Manage</LinkButton>}
          className="lg:col-span-2"
        >
          {data.courses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="You have not created a course yet"
              description="Create a course, add modules and lessons, then submit it for publication."
              action={<LinkButton href="/instructor/courses#new">Create your first course</LinkButton>}
              className="border-0 py-6"
            />
          ) : (
            <ul className="divide-y">
              {data.courses.slice(0, 6).map((course) => (
                <li key={course.id} className="grid items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_8rem_12rem]">
                  <div className="min-w-0">
                    <Link href={`/instructor/courses/${course.id}`} className="font-medium hover:underline">
                      {course.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {course.enrolled} enrolled · {course.lessons} published {course.lessons === 1 ? "lesson" : "lessons"}
                    </p>
                  </div>
                  <StatusBadge status={course.status} />
                  <ProgressBar
                    value={course.enrolled === 0 ? 0 : (course.completed / course.enrolled) * 100}
                    label={`Completion rate for ${course.title}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Pending grading"
          actions={<LinkButton href="/instructor/grading" variant="ghost" size="sm">View all</LinkButton>}
        >
          {data.pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is waiting to be graded.</p>
          ) : (
            <ul className="divide-y">
              {data.pending.slice(0, 6).map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={item.href} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.learnerName} · {item.courseTitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <LocalTime value={item.submittedAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Upcoming assessments">
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled quizzes or examinations.</p>
          ) : (
            <ul className="divide-y">
              {data.upcoming.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/instructor/assessments/${item.id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(item.kind)} · {item.courseTitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {item.startsAt && item.startsAt > new Date() ? "Opens " : "Closes "}
                    <LocalTime value={item.startsAt && item.startsAt > new Date() ? item.startsAt : item.endsAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent submissions" className="lg:col-span-2">
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Assignment submissions from your learners will appear here.</p>
          ) : (
            <ul className="divide-y">
              {data.recent.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/instructor/submissions/${item.id}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.learnerName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-muted-foreground">
                      <LocalTime value={item.submittedAt} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

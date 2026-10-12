import type { Metadata } from "next";
import Link from "next/link";
import { Award, CircleCheck, Circle, ClipboardList, FileText, MessagesSquare, PlayCircle } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, LinkButton, PageHeader, ProgressBar, Section, StatusBadge } from "@/components/kit/primitives";
import { formatDuration, titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { load } from "@/server/page";
import { courseWorkspace } from "@/server/queries/learner";

export const metadata: Metadata = { title: "Course" };

export default async function CourseHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await requireActor(`/learn/courses/${slug}`);
  const data = await load(() => courseWorkspace(actor, slug), { forbidden: `/courses/${slug}` });
  const { course, progress, completion } = data;
  const completed = data.enrollment?.status === "completed";
  const firstIncomplete = data.modules.flatMap((m) => m.lessons).find((l) => !l.completed);
  const resumeId =
    (data.enrollment?.lastLessonId && data.lessonOrder.includes(data.enrollment.lastLessonId)
      ? data.enrollment.lastLessonId
      : null) ??
    firstIncomplete?.id ??
    data.lessonOrder[0];

  const requirements = [
    completion.lessons.required && {
      label: `Complete all lessons (${completion.lessons.done} of ${completion.lessons.total})`,
      met: completion.lessons.met,
    },
    completion.assessments.required &&
      completion.assessments.total > 0 && {
        label: `Pass required assessments (${completion.assessments.passed} of ${completion.assessments.total})`,
        met: completion.assessments.met,
      },
    completion.assignments.required &&
      completion.assignments.total > 0 && {
        label: `Pass required assignments (${completion.assignments.passed} of ${completion.assignments.total})`,
        met: completion.assignments.met,
      },
  ].filter((r): r is { label: string; met: boolean } => !!r);

  return (
    <>
      <PageHeader
        title={course.title}
        description={
          data.staff && !data.enrollment
            ? "Preview mode: you are viewing this course as its staff. Progress is not recorded."
            : course.shortDescription
        }
        back={{ href: "/learn/courses", label: "My courses" }}
        actions={
          <>
            <LinkButton href={`/learn/courses/${slug}/discussions`} variant="outline">
              <MessagesSquare aria-hidden /> Discussions
            </LinkButton>
            {resumeId && (
              <LinkButton href={`/learn/courses/${slug}/lessons/${resumeId}`}>
                <PlayCircle aria-hidden />
                {progress.completed === 0 ? "Start course" : completed ? "Review lessons" : "Continue"}
              </LinkButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Course content" description={`${progress.completed} of ${progress.total} lessons completed`}>
            {data.modules.length === 0 ? (
              <EmptyState title="No lessons are available yet" description="The instructor has not published any lessons." />
            ) : (
              <div className="space-y-4">
                {data.modules.map((module, index) => {
                  const done = module.lessons.filter((l) => l.completed).length;
                  return (
                    <div key={module.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <h3 className="font-medium">
                          {index + 1}. {module.title}
                        </h3>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {done}/{module.lessons.length}
                        </span>
                      </div>
                      <ul className="divide-y rounded-lg border">
                        {module.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <Link
                              href={`/learn/courses/${slug}/lessons/${lesson.id}`}
                              className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted"
                            >
                              {lesson.completed ? (
                                <CircleCheck className="size-4 shrink-0 text-success" aria-label="Completed" />
                              ) : (
                                <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="Not completed" />
                              )}
                              <span className="min-w-0 flex-1">{lesson.title}</span>
                              {lesson.estimatedMinutes > 0 && (
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {formatDuration(lesson.estimatedMinutes)}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {(data.assessments.length > 0 || data.assignments.length > 0) && (
            <Section title="Assessments and assignments">
              <ul className="divide-y">
                {data.assessments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/learn/assessments/${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {titleCase(a.kind)}
                        {a.requiredForCompletion ? " · Required" : ""}
                        {a.endsAt ? " · Closes " : ""}
                        {a.endsAt && <LocalTime value={a.endsAt} />}
                      </p>
                    </div>
                    <StatusBadge
                      status={a.passed ? "passed" : a.attempts > 0 ? "submitted" : "draft"}
                      label={a.passed ? "Passed" : a.attempts > 0 ? "Attempted" : "Not started"}
                    />
                  </li>
                ))}
                {data.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/learn/assignments/${a.id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Assignment
                        {a.requiredForCompletion ? " · Required" : ""}
                        {a.dueAt ? " · Due " : ""}
                        {a.dueAt && <LocalTime value={a.dueAt} />}
                      </p>
                    </div>
                    <StatusBadge status={a.status ?? "draft"} label={a.status ? titleCase(a.status) : "Not started"} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Announcements">
            {data.announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements for this course yet.</p>
            ) : (
              <ul className="space-y-4">
                {data.announcements.map((item) => (
                  <li key={item.id}>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <LocalTime value={item.createdAt} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Your progress">
            <ProgressBar value={completed ? 100 : progress.percent} label="Course progress" />
            {requirements.length > 0 && (
              <>
                <p className="mt-4 mb-2 text-sm font-medium">To complete this course</p>
                <ul className="space-y-1.5 text-sm">
                  {requirements.map((r) => (
                    <li key={r.label} className="flex items-start gap-2">
                      {r.met ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Done" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Outstanding" />
                      )}
                      {r.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {data.certificate ? (
              <div className="mt-4 rounded-lg border bg-accent/40 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Award className="size-4 text-primary" aria-hidden /> Certificate earned
                </p>
                <LinkButton href="/learn/certificates" size="sm" className="mt-2">
                  View certificate
                </LinkButton>
              </div>
            ) : (
              course.certificateEnabled && (
                <p className="mt-4 text-xs text-muted-foreground">
                  A certificate is issued automatically when every requirement is met.
                </p>
              )
            )}
          </Section>

          <Section title={data.team.length > 1 ? "Instructors" : "Instructor"}>
            <ul className="space-y-2 text-sm">
              {data.team.map((person) => (
                <li key={person.name}>
                  <p className="font-medium">{person.name}</p>
                  {person.headline && <p className="text-muted-foreground">{person.headline}</p>}
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Award, BookOpen, CalendarClock, CircleCheck, Megaphone, PlayCircle, TrendingUp, Video } from "lucide-react";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, LinkButton, ProgressBar, Section, StatCard } from "@/components/kit/primitives";
import { CourseCard, CourseGrid, CourseThumb } from "@/components/site/course-card";
import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { requireActor } from "@/server/auth/session";
import { learnerDashboard } from "@/server/queries/learner";

export const metadata: Metadata = { title: "My learning" };

const BADGES: Record<string, string> = {
  first_enrollment: "First enrollment",
  first_lesson: "First lesson completed",
  course_completed: "Course completed",
  perfect_score: "Perfect score",
};

export default async function LearnerDashboardPage() {
  const actor = await requireActor("/learn");
  const data = await learnerDashboard(actor);
  const next = data.continueWith;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {actor.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.inProgress.length > 0
            ? `You have ${data.inProgress.length} ${data.inProgress.length === 1 ? "course" : "courses"} in progress.`
            : "Pick a course to get started."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled courses" value={data.enrolled.length} icon={BookOpen} href="/learn/courses" />
        <StatCard label="Average progress" value={`${data.average}%`} icon={TrendingUp} />
        <StatCard label="Completed" value={data.completed.length} icon={CircleCheck} />
        <StatCard label="Certificates" value={data.certificates.length} icon={Award} href="/learn/certificates" />
      </div>

      {next && (
        <section aria-labelledby="continue-heading" className="overflow-hidden rounded-xl border bg-card sm:flex">
          <CourseThumb fileId={next.course.thumbnailFileId} title={next.course.title} className="sm:w-64 sm:shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
            <p id="continue-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Continue learning
            </p>
            <h2 className="text-lg font-semibold">{next.course.title}</h2>
            <p className="text-sm text-muted-foreground">
              {next.lastLessonTitle ? `Last lesson: ${next.lastLessonTitle}` : "You have not started this course yet."}
            </p>
            <ProgressBar value={next.enrollment.progressPercent} label={`Progress in ${next.course.title}`} className="max-w-md" />
            <div className="mt-auto pt-2">
              <LinkButton
                href={
                  next.enrollment.lastLessonId
                    ? `/learn/courses/${next.course.slug}/lessons/${next.enrollment.lastLessonId}`
                    : `/learn/courses/${next.course.slug}`
                }
              >
                <PlayCircle aria-hidden />
                {next.enrollment.lastLessonId ? "Resume" : "Start course"}
              </LinkButton>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="courses-heading">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="courses-heading" className="text-lg font-semibold">
            My courses
          </h2>
          {data.enrolled.length > 4 && (
            <Link href="/learn/courses" className="text-sm text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        {data.enrolled.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="You are not enrolled in any course yet"
            description="Browse the catalog to find a course and start learning."
            action={<LinkButton href="/courses">Browse courses</LinkButton>}
          />
        ) : (
          <CourseGrid>
            {data.enrolled.slice(0, 4).map(({ course, enrollment }) => (
              <CourseCard
                key={course.id}
                course={course}
                href={`/learn/courses/${course.slug}`}
                progress={enrollment.status === "completed" ? 100 : enrollment.progressPercent}
              />
            ))}
          </CourseGrid>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Upcoming deadlines" actions={<LinkButton href="/learn/calendar" variant="ghost" size="sm">Calendar</LinkButton>}>
          {data.deadlines.length === 0 && data.live.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming assignments, examinations or live sessions.</p>
          ) : (
            <ul className="divide-y">
              {data.deadlines.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(item.kind)} in {item.courseTitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <LocalTime value={item.dueAt} />
                  </span>
                </li>
              ))}
              {data.live.map(({ session, courseTitle }) => (
                <li key={session.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Video className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link href="/learn/calendar" className="font-medium hover:underline">
                      {session.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">Live session in {courseTitle}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <LocalTime value={session.startsAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent announcements">
          {data.news.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ul className="divide-y">
              {data.news.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.title}</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.courseTitle ?? "Platform"} &middot; <LocalTime value={item.createdAt} dateOnly />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent activity">
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your learning activity will appear here.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.activity.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                  {event.link ? (
                    <Link href={event.link} className="min-w-0 hover:underline">
                      {event.summary}
                    </Link>
                  ) : (
                    <span className="min-w-0">{event.summary}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    <LocalTime value={event.createdAt} dateOnly />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Certificates and achievements"
          actions={<LinkButton href="/learn/certificates" variant="ghost" size="sm">View all</LinkButton>}
        >
          {data.certificates.length === 0 && data.badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Complete a course to earn your first certificate.
            </p>
          ) : (
            <div className="space-y-3">
              {data.certificates.length > 0 && (
                <ul className="space-y-2">
                  {data.certificates.map((cert) => (
                    <li key={cert.id} className="flex items-center gap-3 text-sm">
                      <Award className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{cert.courseTitle}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        <LocalTime value={cert.issuedAt} dateOnly />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {data.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.badges.map((badge) => (
                    <Badge key={badge.badge} variant="secondary">
                      {BADGES[badge.badge] ?? titleCase(badge.badge)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

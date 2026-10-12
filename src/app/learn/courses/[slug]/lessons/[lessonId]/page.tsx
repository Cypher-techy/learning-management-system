import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Circle, CircleCheck, ClipboardList, FileText } from "lucide-react";
import { bookmarkAction, lessonCompleteAction, saveNoteAction } from "@/app/actions/learner";
import { ActionButton } from "@/components/kit/confirm";
import { ActionForm, FormMessage, SubmitButton, TextAreaField } from "@/components/kit/form";
import { LinkButton, ProgressBar } from "@/components/kit/primitives";
import { LessonContent } from "@/components/learn/lesson-content";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireActor } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { courseWorkspace, lessonView } from "@/server/queries/learner";
import { recordLessonVisit } from "@/server/services/progress";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId: rawId } = await params;
  const lessonId = uuidParam(rawId);
  const actor = await requireActor(`/learn/courses/${slug}/lessons/${lessonId}`);
  const [view, workspace] = await load(
    () => Promise.all([lessonView(actor, lessonId), courseWorkspace(actor, slug)]),
    { forbidden: `/courses/${slug}` },
  );
  if (view.course.slug !== slug) notFound();
  // Opening a lesson is remembered for "continue learning"; it is not completion.
  await recordLessonVisit(actor, lessonId);

  const order = workspace.lessonOrder;
  const index = order.indexOf(lessonId);
  const previous = index > 0 ? order[index - 1] : null;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : null;
  const tracked = !!view.enrollment && (view.enrollment.status === "active" || view.enrollment.status === "completed");
  const related = [
    ...workspace.assessments.filter((a) => a.lessonId === lessonId).map((a) => ({ href: `/learn/assessments/${a.id}`, title: a.title, icon: ClipboardList })),
    ...workspace.assignments.filter((a) => a.lessonId === lessonId).map((a) => ({ href: `/learn/assignments/${a.id}`, title: a.title, icon: FileText })),
  ];

  const outline = (
    <nav aria-label="Course lessons" className="space-y-4">
      {workspace.modules.map((module, moduleIndex) => (
        <div key={module.id}>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {moduleIndex + 1}. {module.title}
          </p>
          <ul className="space-y-0.5">
            {module.lessons.map((lesson) => {
              const active = lesson.id === lessonId;
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/learn/courses/${slug}/lessons/${lesson.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                      active && "bg-accent font-medium text-accent-foreground",
                    )}
                  >
                    {lesson.completed ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Completed" />
                    ) : (
                      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Not completed" />
                    )}
                    <span className="min-w-0 flex-1">{lesson.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
        <Link href={`/learn/courses/${slug}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          {view.course.title}
        </Link>
        <ProgressBar value={workspace.progress.percent} label="Course progress" className="mb-4" />
        <details className="rounded-lg border bg-card p-3 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium">
            Lessons ({workspace.progress.completed}/{workspace.progress.total} completed)
          </summary>
          <div className="mt-3">{outline}</div>
        </details>
        <div className="hidden lg:block">{outline}</div>
      </aside>

      <article className="min-w-0">
        <header className="mb-5">
          <p className="text-sm text-muted-foreground">
            Lesson {index + 1} of {order.length}
            {view.lesson.estimatedMinutes > 0 ? ` · ${formatDuration(view.lesson.estimatedMinutes)}` : ""}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{view.lesson.title}</h1>
          {view.lesson.description && <p className="mt-2 text-muted-foreground">{view.lesson.description}</p>}
          {view.staff && !tracked && (
            <p className="mt-3 rounded-lg border bg-muted px-3 py-2 text-sm">
              Preview mode. You are viewing this lesson as course staff; completion is not recorded.
            </p>
          )}
        </header>

        <LessonContent lesson={view.lesson} resources={view.resources} videoPosition={view.videoPosition} track={tracked} />

        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-8">
            <h2 id="related-heading" className="mb-2 text-base font-semibold">
              For this lesson
            </h2>
            <ul className="divide-y rounded-lg border">
              {related.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted">
                    <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tracked && (
          <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-5">
            <ActionButton
              action={lessonCompleteAction}
              fields={{ lessonId, completed: view.completed ? "false" : "true" }}
              variant={view.completed ? "outline" : "default"}
              aria-pressed={view.completed}
            >
              <CircleCheck aria-hidden />
              {view.completed ? "Completed (mark as incomplete)" : "Mark lesson complete"}
            </ActionButton>
            <ActionButton action={bookmarkAction} fields={{ lessonId }} aria-pressed={view.bookmarked}>
              {view.bookmarked ? <BookmarkCheck aria-hidden /> : <Bookmark aria-hidden />}
              {view.bookmarked ? "Bookmarked" : "Bookmark"}
            </ActionButton>
          </div>
        )}

        <nav aria-label="Lesson navigation" className="mt-5 flex items-center justify-between gap-2">
          {previous ? (
            <LinkButton href={`/learn/courses/${slug}/lessons/${previous}`} variant="outline">
              <ChevronLeft aria-hidden /> Previous
            </LinkButton>
          ) : (
            <span />
          )}
          {next ? (
            <LinkButton href={`/learn/courses/${slug}/lessons/${next}`} variant="outline">
              Next <ChevronRight aria-hidden />
            </LinkButton>
          ) : (
            <LinkButton href={`/learn/courses/${slug}`} variant="outline">
              Course overview
            </LinkButton>
          )}
        </nav>

        {tracked && (
          <section aria-labelledby="notes-heading" className="mt-8 rounded-xl border bg-card p-4">
            <h2 id="notes-heading" className="text-base font-semibold">
              My notes
            </h2>
            <p className="text-sm text-muted-foreground">Private to you. Find all your notes under Bookmarks and notes.</p>
            <ActionForm action={saveNoteAction} className="mt-3 grid gap-3">
              <input type="hidden" name="lessonId" value={lessonId} />
              <FormMessage />
              <TextAreaField label="Notes for this lesson" name="content" rows={4} defaultValue={view.note} maxLength={20000} />
              <div>
                <SubmitButton variant="outline" pendingLabel="Saving...">
                  Save note
                </SubmitButton>
              </div>
            </ActionForm>
          </section>
        )}
      </article>
    </div>
  );
}

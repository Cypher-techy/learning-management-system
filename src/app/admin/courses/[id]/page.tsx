import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { CircleAlert, CircleCheck } from "lucide-react";
import { deleteCourseAction, reviewCourseAction } from "@/app/actions/admin";
import { courseStatusAction } from "@/app/actions/instructor";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LinkButton, Markdown, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { formatDuration, formatMoney, titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { uuidParam } from "@/server/page";
import { getCourseTeam, getCurriculum, publicationIssues } from "@/server/services/courses";

export const metadata: Metadata = { title: "Review course" };

export default async function AdminCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  await requirePermission("course.manage_any");
  const [course] = await db.select().from(schema.courses).where(eq(schema.courses.id, id));
  if (!course) notFound();
  const [team, curriculum, issues, [enrolled], [category]] = await Promise.all([
    getCourseTeam(id),
    getCurriculum(id),
    publicationIssues(id),
    db.select({ n: count() }).from(schema.enrollments).where(eq(schema.enrollments.courseId, id)),
    course.categoryId ? db.select().from(schema.categories).where(eq(schema.categories.id, course.categoryId)) : Promise.resolve([]),
  ]);
  const enrollmentCount = enrolled?.n ?? 0;

  return (
    <>
      <PageHeader
        title={course.title}
        description={`${team.find((t) => t.role === "owner")?.name ?? "Unknown owner"} · ${category?.name ?? "No category"} · ${formatMoney(course.priceCents, course.currency)}`}
        back={{ href: "/admin/courses", label: "Courses" }}
        actions={
          <>
            <StatusBadge status={course.status} label={course.status === "pending_review" ? "Awaiting review" : undefined} />
            <LinkButton href={`/learn/courses/${course.slug}`} variant="outline">
              Preview
            </LinkButton>
            <LinkButton href={`/instructor/courses/${id}`} variant="outline">
              Open editor
            </LinkButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Description">
            <p className="text-sm text-muted-foreground">{course.shortDescription || "No short description."}</p>
            {course.description && <Markdown className="mt-3">{course.description}</Markdown>}
            {course.objectives.length > 0 && (
              <>
                <p className="mt-4 text-sm font-medium">Learning objectives</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {course.objectives.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>
          <Section title="Curriculum" description={`${curriculum.length} modules`}>
            {curriculum.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {curriculum.map((m, i) => (
                  <li key={m.id}>
                    <p className="font-medium">
                      {i + 1}. {m.title}
                      {!m.isPublished && <span className="ml-2 text-xs font-normal text-muted-foreground">(hidden)</span>}
                    </p>
                    <ul className="mt-1 space-y-0.5 pl-5 text-muted-foreground">
                      {m.lessons.map((l) => (
                        <li key={l.id}>
                          {l.title}
                          {l.estimatedMinutes > 0 ? ` · ${formatDuration(l.estimatedMinutes)}` : ""}
                          {!l.isPublished ? " (hidden)" : ""}
                          {l.isPreview ? " (free preview)" : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Review">
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm">
                <CircleCheck className="size-4 text-success" aria-hidden /> Meets the publication requirements.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CircleAlert className="size-4 text-warning" aria-hidden /> Not ready to publish
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </>
            )}
            {course.status === "pending_review" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <ConfirmAction
                  action={reviewCourseAction}
                  fields={{ courseId: id, decision: "approve" }}
                  title="Approve and publish this course?"
                  description="It appears in the public catalog immediately and the instructor is notified."
                  reasonField={{ name: "note", label: "Note to the instructor (optional)" }}
                  confirmLabel="Approve and publish"
                  variant="default"
                  disabled={issues.length > 0}
                >
                  Approve
                </ConfirmAction>
                <ConfirmAction
                  action={reviewCourseAction}
                  fields={{ courseId: id, decision: "reject" }}
                  title="Request changes?"
                  description="The course returns to draft and the instructor sees your note."
                  reasonField={{ name: "note", label: "What needs to change", required: true }}
                  confirmLabel="Send back"
                  destructive
                >
                  Request changes
                </ConfirmAction>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                This course is {titleCase(course.status).toLowerCase()}. It is not waiting for review.
              </p>
            )}
          </Section>

          <Section title="Status controls">
            <div className="flex flex-wrap gap-2">
              {course.status === "published" && (
                <ConfirmAction
                  action={courseStatusAction}
                  fields={{ courseId: id, action: "unpublish" }}
                  title="Unpublish this course?"
                  description="It leaves the catalog. Enrolled learners keep access."
                  confirmLabel="Unpublish"
                >
                  Unpublish
                </ConfirmAction>
              )}
              {course.status === "archived" ? (
                <ActionButton action={courseStatusAction} fields={{ courseId: id, action: "restore" }}>
                  Restore to draft
                </ActionButton>
              ) : (
                <ConfirmAction
                  action={courseStatusAction}
                  fields={{ courseId: id, action: "archive" }}
                  title="Archive this course?"
                  description="It is hidden from everyone, including enrolled learners. Records are kept."
                  confirmLabel="Archive"
                  destructive
                >
                  Archive
                </ConfirmAction>
              )}
            </div>
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium">Remove permanently</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {enrollmentCount > 0
                  ? `This course has ${enrollmentCount} enrollment records and cannot be deleted. Archive it instead.`
                  : "Only possible while nobody has ever enrolled."}
              </p>
              <ConfirmAction
                action={deleteCourseAction}
                fields={{ courseId: id }}
                title={`Permanently delete "${course.title}"?`}
                description="All modules, lessons, assessments and files are removed. This cannot be undone."
                requirePassword
                confirmLabel="Delete course"
                destructive
                variant="ghost"
                className="mt-2"
                disabled={enrollmentCount > 0}
              >
                Delete course
              </ConfirmAction>
            </div>
          </Section>

          <Section title="Teaching team">
            <ul className="space-y-1.5 text-sm">
              {team.map((t) => (
                <li key={t.userId}>
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground"> · {t.role === "owner" ? "Owner" : "Instructor"}</span>
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </>
  );
}

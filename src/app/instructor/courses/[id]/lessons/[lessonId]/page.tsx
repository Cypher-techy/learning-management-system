import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ExternalLink, FileText } from "lucide-react";
import {
  addFileResourceAction,
  addLinkResourceAction,
  deleteLessonAction,
  deleteResourceAction,
  setLessonVideoAction,
  updateLessonAction,
} from "@/app/actions/instructor";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { ActionForm, CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { LinkButton, Section } from "@/components/kit/primitives";
import { UploadAction } from "@/components/kit/upload";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { getPlatform } from "@/server/queries/context";
import { load, uuidParam } from "@/server/page";
import { assertCanManageCourse } from "@/server/services/courses";

export const metadata: Metadata = { title: "Edit lesson" };

export default async function LessonEditorPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const p = await params;
  const id = uuidParam(p.id);
  const lessonId = uuidParam(p.lessonId);
  const actor = await requirePermission("course.create");
  const course = await load(() => assertCanManageCourse(actor, id));
  const [lesson] = await db
    .select()
    .from(schema.lessons)
    .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.courseId, id)));
  if (!lesson) notFound();
  const [resources, platform] = await Promise.all([
    db
      .select()
      .from(schema.lessonResources)
      .where(eq(schema.lessonResources.lessonId, lessonId))
      .orderBy(asc(schema.lessonResources.position), asc(schema.lessonResources.createdAt)),
    getPlatform(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="min-w-0">
        <Section
          title="Lesson"
          actions={
            <LinkButton href={`/learn/courses/${course.slug}/lessons/${lessonId}`} variant="outline" size="sm">
              Preview
            </LinkButton>
          }
        >
          <ActionForm action={updateLessonAction} className="grid gap-4">
            <input type="hidden" name="lessonId" value={lessonId} />
            <TextField label="Title" name="title" defaultValue={lesson.title} required minLength={2} maxLength={160} />
            <TextField label="Summary" name="description" defaultValue={lesson.description} maxLength={1000} hint="Shown under the lesson title." />
            <TextAreaField
              label="Lesson content"
              name="content"
              defaultValue={lesson.content}
              rows={18}
              maxLength={100000}
              className="font-mono"
              hint="Markdown: # headings, **bold**, lists, links, tables and code blocks. Raw HTML is not rendered."
            />
            <TextField
              label="Video link"
              name="videoUrl"
              type="url"
              defaultValue={lesson.videoUrl ?? ""}
              placeholder="https://www.youtube.com/watch?v=..."
              hint="YouTube, Vimeo or a direct https link to an MP4 or WebM file. Leave empty if you upload a video instead."
            />
            <TextField
              label="Estimated time (minutes)"
              name="estimatedMinutes"
              type="number"
              min={0}
              max={6000}
              defaultValue={lesson.estimatedMinutes || ""}
              className="max-w-48"
            />
            <CheckboxField
              label="Published"
              name="isPublished"
              defaultChecked={lesson.isPublished}
              hint="Hidden lessons are not shown to learners and do not count towards progress."
            />
            <CheckboxField
              label="Free preview"
              name="isPreview"
              defaultChecked={lesson.isPreview}
              hint="Anyone can open a preview lesson from the public course page without enrolling."
            />
            <FormMessage />
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton pendingLabel="Saving...">Save lesson</SubmitButton>
              <LinkButton href={`/instructor/courses/${id}/curriculum`} variant="ghost">
                Back to curriculum
              </LinkButton>
              <span className="ml-auto">
                <ConfirmAction
                  action={deleteLessonAction}
                  fields={{ lessonId }}
                  title="Delete this lesson?"
                  description="The lesson, its resources and learners' progress in it are permanently deleted."
                  confirmLabel="Delete lesson"
                  destructive
                  variant="ghost"
                >
                  Delete lesson
                </ConfirmAction>
              </span>
            </div>
          </ActionForm>
        </Section>
      </div>

      <aside className="space-y-6">
        <Section title="Uploaded video" description={`MP4 or WebM, up to ${platform.maxUploadMb} MB.`}>
          {lesson.videoFileId ? (
            <>
              <video src={`/api/files/${lesson.videoFileId}`} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
              <div className="mt-3 flex flex-wrap gap-2">
                <UploadAction action={setLessonVideoAction} purpose="lesson_video" courseId={id} fields={{ lessonId }} accept={["mp4", "webm"]}>
                  Replace video
                </UploadAction>
                <ActionButton action={setLessonVideoAction} fields={{ lessonId, fileId: "" }} variant="ghost">
                  Remove
                </ActionButton>
              </div>
            </>
          ) : (
            <UploadAction action={setLessonVideoAction} purpose="lesson_video" courseId={id} fields={{ lessonId }} accept={["mp4", "webm"]}>
              Upload video
            </UploadAction>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            For long recordings, host the video on a streaming service and paste its link instead. Streaming services
            adapt to slow connections; an uploaded file is delivered as it is.
          </p>
        </Section>

        <Section title="Resources" description="Files and links learners can open from this lesson.">
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources attached.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {resources.map((resource) => (
                <li key={resource.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {resource.kind === "file" ? (
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <a
                    href={resource.kind === "file" ? `/api/files/${resource.fileId}?download=1` : (resource.url ?? "#")}
                    target={resource.kind === "link" ? "_blank" : undefined}
                    rel={resource.kind === "link" ? "noopener noreferrer" : undefined}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {resource.title}
                  </a>
                  <ActionButton
                    action={deleteResourceAction}
                    fields={{ resourceId: resource.id }}
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${resource.title}`}
                  >
                    Remove
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <UploadAction
              action={addFileResourceAction}
              purpose="lesson_resource"
              courseId={id}
              fields={{ lessonId }}
              accept={platform.allowedUploadExtensions}
            >
              Upload a file
            </UploadAction>
          </div>
          <ActionForm action={addLinkResourceAction} resetOnSuccess className="mt-4 grid gap-3 border-t pt-4">
            <input type="hidden" name="lessonId" value={lessonId} />
            <FormMessage />
            <TextField label="Link title" name="title" required minLength={2} maxLength={160} />
            <TextField label="Link address" name="url" type="url" required placeholder="https://" />
            <div>
              <SubmitButton variant="outline" pendingLabel="Adding...">
                Add link
              </SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </aside>
    </div>
  );
}

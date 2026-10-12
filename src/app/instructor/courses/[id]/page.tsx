import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { CircleAlert, CircleCheck } from "lucide-react";
import {
  addInstructorAction,
  courseStatusAction,
  publishCourseAction,
  removeInstructorAction,
  setThumbnailAction,
  updateCourseAction,
} from "@/app/actions/instructor";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import {
  ActionForm,
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/kit/form";
import { checkboxClass, Section } from "@/components/kit/primitives";
import { UploadAction } from "@/components/kit/upload";
import { CourseThumb } from "@/components/site/course-card";
import { requirePermission } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { can } from "@/server/permissions";
import { getPlatform } from "@/server/queries/context";
import { load, uuidParam } from "@/server/page";
import { assertCanManageCourse, getCourseTeam, publicationIssues } from "@/server/services/courses";

export const metadata: Metadata = { title: "Course details" };

export default async function CourseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requirePermission("course.create");
  const course = await load(() => assertCanManageCourse(actor, id));
  const [categories, tags, courseTags, team, issues, platform] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.name)),
    db.select().from(schema.tags).orderBy(asc(schema.tags.name)),
    db.select().from(schema.courseTags).where(eq(schema.courseTags.courseId, id)),
    getCourseTeam(id),
    publicationIssues(id),
    getPlatform(),
  ]);
  const selectedTags = new Set(courseTags.map((t) => t.tagId));
  const archived = course.status === "archived";
  const direct = can(actor, "course.review") || can(actor, "course.publish_direct") || !platform.courseApprovalRequired;
  const isOwner = course.ownerId === actor.id || can(actor, "course.manage_any");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <ActionForm action={updateCourseAction} className="min-w-0 space-y-6">
        <input type="hidden" name="courseId" value={id} />
        <Section title="Basic information">
          <fieldset disabled={archived} className="grid gap-4">
            <TextField label="Title" name="title" defaultValue={course.title} required minLength={4} maxLength={120} />
            <TextField
              label="Web address"
              name="slug"
              defaultValue={course.slug}
              required
              maxLength={80}
              hint={`Appears in the course link: /courses/${course.slug}`}
            />
            <TextField
              label="Short description"
              name="shortDescription"
              defaultValue={course.shortDescription}
              maxLength={200}
              hint="One or two sentences shown on course cards. At least 20 characters to publish."
            />
            <TextAreaField
              label="Full description"
              name="description"
              defaultValue={course.description}
              rows={8}
              maxLength={10000}
              hint="Markdown is supported. At least 50 characters to publish."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Category"
                name="categoryId"
                defaultValue={course.categoryId ?? ""}
                options={[{ value: "", label: "Choose a category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <SelectField
                label="Difficulty"
                name="level"
                defaultValue={course.level}
                options={[
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                  { value: "all_levels", label: "All levels" },
                ]}
              />
              <TextField label="Language" name="language" defaultValue={course.language} required maxLength={40} />
              <TextField
                label="Estimated duration (hours)"
                name="estimatedHours"
                type="number"
                min={0}
                step="0.5"
                defaultValue={course.estimatedMinutes ? course.estimatedMinutes / 60 : ""}
              />
            </div>
            {tags.length > 0 && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Tags</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selectedTags.has(tag.id)} className={checkboxClass} />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </fieldset>
        </Section>

        <Section title="Learning outcomes">
          <fieldset disabled={archived} className="grid gap-4">
            <TextAreaField
              label="Learning objectives"
              name="objectives"
              defaultValue={course.objectives.join("\n")}
              rows={5}
              hint="One objective per line. At least one is needed to publish."
            />
            <TextAreaField
              label="Prerequisites"
              name="prerequisites"
              defaultValue={course.prerequisites.join("\n")}
              rows={3}
              hint="One per line. Leave empty if there are none."
            />
          </fieldset>
        </Section>

        <Section title="Enrollment and pricing">
          <fieldset disabled={archived} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={`Price (${course.currency})`}
                name="price"
                type="number"
                min={0}
                step="1"
                defaultValue={course.priceCents / 100}
                hint="Enter 0 for a free course."
              />
              <TextField
                label="Enrollment limit"
                name="enrollmentLimit"
                type="number"
                min={1}
                defaultValue={course.enrollmentLimit ?? ""}
                hint="Leave empty for unlimited seats."
              />
            </div>
            <CheckboxField
              label="Enrollment is open"
              name="enrollmentOpen"
              defaultChecked={course.enrollmentOpen}
              hint="When closed, the course stays visible but nobody new can enroll."
            />
          </fieldset>
        </Section>

        <Section title="Completion requirements" description="A learner completes the course when every selected rule is met.">
          <fieldset disabled={archived} className="grid gap-3">
            <CheckboxField label="Complete every published lesson" name="requireAllLessons" defaultChecked={course.requireAllLessons} />
            <CheckboxField
              label="Pass every required quiz and examination"
              name="requireAssessments"
              defaultChecked={course.requireAssessments}
            />
            <CheckboxField
              label="Pass every required assignment"
              name="requireAssignments"
              defaultChecked={course.requireAssignments}
            />
            <CheckboxField
              label="Issue a certificate on completion"
              name="certificateEnabled"
              defaultChecked={course.certificateEnabled}
            />
          </fieldset>
        </Section>

        <FormMessage />
        {!archived && (
          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Saving...">Save details</SubmitButton>
            <p className="text-sm text-muted-foreground">Saving keeps the course in its current status.</p>
          </div>
        )}
      </ActionForm>

      <aside className="space-y-6">
        <Section title="Publication">
          {course.status === "draft" && course.reviewNote && (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <span className="font-medium">Changes requested:</span> {course.reviewNote}
            </p>
          )}
          {course.status === "published" ? (
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-4 text-success" aria-hidden /> Live in the course catalog.
            </p>
          ) : course.status === "pending_review" ? (
            <p className="text-sm">Waiting for an administrator to review this course.</p>
          ) : issues.length === 0 ? (
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck className="size-4 text-success" aria-hidden /> Ready to publish.
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleAlert className="size-4 text-warning" aria-hidden /> Before this course can be published:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {(course.status === "draft" || course.status === "unpublished") && (
              <ActionButton action={publishCourseAction} fields={{ courseId: id }} variant="default" disabled={issues.length > 0}>
                {direct ? "Publish course" : "Submit for review"}
              </ActionButton>
            )}
            {course.status === "pending_review" && (
              <ActionButton action={courseStatusAction} fields={{ courseId: id, action: "withdraw" }}>
                Withdraw from review
              </ActionButton>
            )}
            {course.status === "published" && (
              <ConfirmAction
                action={courseStatusAction}
                fields={{ courseId: id, action: "unpublish" }}
                title="Unpublish this course?"
                description="It leaves the catalog and nobody new can enroll. Learners who are already enrolled keep their access."
                confirmLabel="Unpublish"
              >
                Unpublish
              </ConfirmAction>
            )}
            {archived ? (
              <ActionButton action={courseStatusAction} fields={{ courseId: id, action: "restore" }}>
                Restore to draft
              </ActionButton>
            ) : (
              <ConfirmAction
                action={courseStatusAction}
                fields={{ courseId: id, action: "archive" }}
                title="Archive this course?"
                description="Archived courses are hidden from everyone, including enrolled learners. Records are kept and the course can be restored."
                confirmLabel="Archive"
                destructive
                variant="ghost"
              >
                Archive
              </ConfirmAction>
            )}
          </div>
          {!direct && (course.status === "draft" || course.status === "unpublished") && (
            <p className="mt-3 text-xs text-muted-foreground">An administrator reviews courses before they go live.</p>
          )}
        </Section>

        <Section title="Thumbnail" description="PNG, JPG or WebP, up to 5 MB. 16:9 works best.">
          <CourseThumb fileId={course.thumbnailFileId} title={course.title} className="rounded-lg border" />
          {!archived && (
            <div className="mt-3 flex flex-wrap gap-2">
              <UploadAction
                action={setThumbnailAction}
                purpose="course_thumbnail"
                courseId={id}
                fields={{ courseId: id }}
                accept={["png", "jpg", "jpeg", "webp"]}
              >
                {course.thumbnailFileId ? "Replace image" : "Upload image"}
              </UploadAction>
              {course.thumbnailFileId && (
                <ActionButton action={setThumbnailAction} fields={{ courseId: id, fileId: "" }} variant="ghost">
                  Remove
                </ActionButton>
              )}
            </div>
          )}
        </Section>

        <Section title="Teaching team">
          <ul className="space-y-2 text-sm">
            {team.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.role === "owner" ? "Owner" : "Instructor"} · {member.email}
                  </p>
                </div>
                {isOwner && member.role !== "owner" && (
                  <ConfirmAction
                    action={removeInstructorAction}
                    fields={{ courseId: id, userId: member.userId }}
                    title={`Remove ${member.name}?`}
                    description="They will no longer be able to edit this course or grade its learners."
                    confirmLabel="Remove"
                    destructive
                    variant="ghost"
                    size="sm"
                  >
                    Remove
                  </ConfirmAction>
                )}
              </li>
            ))}
          </ul>
          {isOwner && (
            <ActionForm action={addInstructorAction} resetOnSuccess className="mt-4 grid gap-3 border-t pt-4">
              <input type="hidden" name="courseId" value={id} />
              <FormMessage />
              <TextField label="Add an instructor by email" name="email" type="email" required hint="They must already have an instructor account." />
              <div>
                <SubmitButton variant="outline" pendingLabel="Adding...">
                  Add to team
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </Section>
      </aside>
    </div>
  );
}

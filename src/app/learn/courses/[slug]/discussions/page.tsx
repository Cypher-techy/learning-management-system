import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Lock, MessagesSquare, Pin } from "lucide-react";
import { createDiscussionAction } from "@/app/actions/learner";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextAreaField, TextField } from "@/components/kit/form";
import { EmptyState, PageHeader, Section, StatusBadge } from "@/components/kit/primitives";
import { requireActor } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { load } from "@/server/page";
import { listDiscussions } from "@/server/services/community";

export const metadata: Metadata = { title: "Discussions" };

export default async function DiscussionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const actor = await requireActor(`/learn/courses/${slug}/discussions`);
  const [course] = await db
    .select({ id: schema.courses.id, title: schema.courses.title })
    .from(schema.courses)
    .where(eq(schema.courses.slug, slug));
  if (!course) notFound();
  // Only enrolled learners and this course's staff get past this point.
  const { rows, role } = await load(() => listDiscussions(actor, course.id), { forbidden: `/courses/${slug}` });

  return (
    <>
      <PageHeader
        title="Discussions"
        description={course.title}
        back={{ href: `/learn/courses/${slug}`, label: "Back to course" }}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No discussions yet"
              description="Ask a question or share something with others taking this course."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {rows.map((d) => (
                <li key={d.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/discussions/${d.id}`} className="font-medium hover:underline">
                      {d.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.authorName} · <LocalTime value={d.createdAt} dateOnly /> · {d.replyCount}{" "}
                      {d.replyCount === 1 ? "reply" : "replies"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    {d.isPinned && <Pin className="size-4" aria-label="Pinned" />}
                    {d.isLocked && <Lock className="size-4" aria-label="Locked" />}
                    {d.isHidden && role === "moderator" && <StatusBadge status="revoked" label="Hidden" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Section title="Start a discussion" description="Visible to everyone enrolled in this course.">
          <ActionForm action={createDiscussionAction} className="grid gap-4">
            <input type="hidden" name="courseId" value={course.id} />
            <FormMessage />
            <TextField label="Title" name="title" required minLength={5} maxLength={160} />
            <TextAreaField label="Message" name="body" rows={6} required minLength={10} maxLength={10000} />
            <div>
              <SubmitButton pendingLabel="Posting...">Post</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}

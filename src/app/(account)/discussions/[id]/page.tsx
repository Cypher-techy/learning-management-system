import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { moderateDiscussionAction, moderateReplyAction, replyAction, reportAction } from "@/app/actions/learner";
import { ActionButton, ConfirmAction } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { ActionForm, FormMessage, SubmitButton, TextAreaField } from "@/components/kit/form";
import { PageHeader, StatusBadge } from "@/components/kit/primitives";
import { Badge } from "@/components/ui/badge";
import { requireActor } from "@/server/auth/session";
import { load, uuidParam } from "@/server/page";
import { getDiscussion } from "@/server/services/community";

export const metadata: Metadata = { title: "Discussion" };

function RoleTag({ role }: { role: string }) {
  if (role === "student") return null;
  return <Badge variant="secondary">{role === "admin" ? "Administrator" : "Instructor"}</Badge>;
}

export default async function DiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = uuidParam((await params).id);
  const actor = await requireActor(`/discussions/${id}`);
  const { discussion, author, course, replies, role } = await load(() => getDiscussion(actor, id));
  const moderator = role === "moderator";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={discussion.title}
        description={course.title}
        back={{ href: `/learn/courses/${course.slug}/discussions`, label: "All discussions" }}
      />

      <article className="rounded-xl border bg-card p-4">
        <header className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{author.name}</span>
          <RoleTag role={author.role} />
          <span className="text-muted-foreground">
            <LocalTime value={discussion.createdAt} />
          </span>
          {discussion.isHidden && <StatusBadge status="revoked" label="Hidden" />}
          {discussion.isLocked && <StatusBadge status="closed" label="Locked" />}
        </header>
        <p className="mt-3 text-sm leading-6 whitespace-pre-line">{discussion.body}</p>
        <footer className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          {moderator ? (
            <>
              <ActionButton action={moderateDiscussionAction} fields={{ discussionId: id, action: discussion.isPinned ? "unpin" : "pin" }} size="sm">
                {discussion.isPinned ? "Unpin" : "Pin"}
              </ActionButton>
              <ActionButton action={moderateDiscussionAction} fields={{ discussionId: id, action: discussion.isLocked ? "unlock" : "lock" }} size="sm">
                {discussion.isLocked ? "Unlock" : "Lock"}
              </ActionButton>
              <ActionButton action={moderateDiscussionAction} fields={{ discussionId: id, action: discussion.isHidden ? "unhide" : "hide" }} size="sm">
                {discussion.isHidden ? "Unhide" : "Hide"}
              </ActionButton>
            </>
          ) : (
            <ConfirmAction
              action={reportAction}
              fields={{ discussionId: id }}
              title="Report this discussion"
              description="A moderator will review it."
              reasonField={{ name: "reason", label: "What is the problem?", required: true }}
              confirmLabel="Send report"
              variant="ghost"
              size="sm"
            >
              Report
            </ConfirmAction>
          )}
        </footer>
      </article>

      <h2 className="mt-8 mb-3 text-base font-semibold">
        {replies.length} {replies.length === 1 ? "reply" : "replies"}
      </h2>
      <ol className="space-y-3">
        {replies.map((reply) => (
          <li key={reply.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{reply.authorName}</span>
              <RoleTag role={reply.authorRole} />
              <span className="text-muted-foreground">
                <LocalTime value={reply.createdAt} />
              </span>
              {reply.isHidden && <StatusBadge status="revoked" label="Hidden" />}
              <span className="ml-auto">
                {moderator ? (
                  <ActionButton action={moderateReplyAction} fields={{ replyId: reply.id, hidden: reply.isHidden ? "false" : "true" }} variant="ghost" size="sm">
                    {reply.isHidden ? "Unhide" : "Hide"}
                  </ActionButton>
                ) : (
                  reply.authorId !== actor.id && (
                    <ConfirmAction
                      action={reportAction}
                      fields={{ replyId: reply.id }}
                      title="Report this reply"
                      description="A moderator will review it."
                      reasonField={{ name: "reason", label: "What is the problem?", required: true }}
                      confirmLabel="Send report"
                      variant="ghost"
                      size="sm"
                    >
                      Report
                    </ConfirmAction>
                  )
                )}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 whitespace-pre-line">{reply.body}</p>
          </li>
        ))}
      </ol>

      {discussion.isLocked && !moderator ? (
        <p className="mt-6 flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
          <Lock className="size-4" aria-hidden /> This discussion is locked. New replies are not accepted.
        </p>
      ) : (
        <ActionForm action={replyAction} resetOnSuccess className="mt-6 grid gap-3 rounded-xl border bg-card p-4">
          <input type="hidden" name="discussionId" value={id} />
          <FormMessage />
          <TextAreaField label="Your reply" name="body" rows={4} required minLength={2} maxLength={10000} />
          <div>
            <SubmitButton pendingLabel="Posting...">Post reply</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

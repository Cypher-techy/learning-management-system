import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, NotebookPen } from "lucide-react";
import { bookmarkAction } from "@/app/actions/learner";
import { ActionButton } from "@/components/kit/confirm";
import { LocalTime } from "@/components/kit/datetime-field";
import { EmptyState, PageHeader, Section } from "@/components/kit/primitives";
import { requireActor } from "@/server/auth/session";
import { myBookmarksAndNotes } from "@/server/queries/learner";

export const metadata: Metadata = { title: "Bookmarks and notes" };

export default async function BookmarksPage() {
  const actor = await requireActor("/learn/bookmarks");
  const { bookmarks, notes } = await myBookmarksAndNotes(actor.id);

  return (
    <>
      <PageHeader title="Bookmarks and notes" description="Lessons you saved and the private notes you wrote." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Bookmarked lessons">
          {bookmarks.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No bookmarks"
              description="Use the Bookmark button on a lesson to save it here."
              className="border-0 py-6"
            />
          ) : (
            <ul className="divide-y">
              {bookmarks.map((item) => (
                <li key={item.lessonId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <Link href={`/learn/courses/${item.courseSlug}/lessons/${item.lessonId}`} className="font-medium hover:underline">
                      {item.lessonTitle}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.courseTitle}</p>
                  </div>
                  <ActionButton action={bookmarkAction} fields={{ lessonId: item.lessonId }} variant="ghost" size="sm">
                    Remove
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="My notes">
          {notes.length === 0 ? (
            <EmptyState
              icon={NotebookPen}
              title="No notes"
              description="Write notes at the bottom of any lesson. Only you can see them."
              className="border-0 py-6"
            />
          ) : (
            <ul className="space-y-4">
              {notes.map((note) => (
                <li key={note.lessonId}>
                  <Link href={`/learn/courses/${note.courseSlug}/lessons/${note.lessonId}`} className="font-medium hover:underline">
                    {note.lessonTitle}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {note.courseTitle} · updated <LocalTime value={note.updatedAt} dateOnly />
                  </p>
                  <p className="mt-1 line-clamp-4 text-sm whitespace-pre-line">{note.content}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

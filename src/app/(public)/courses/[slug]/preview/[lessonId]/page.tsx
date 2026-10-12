import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonContent } from "@/components/learn/lesson-content";
import { LinkButton, PageHeader } from "@/components/kit/primitives";
import { getPreviewLesson } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Lesson preview" };

export default async function PreviewLessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  // Only lessons explicitly marked as previews of a published course are served here.
  const data = await getPreviewLesson(slug, lessonId);
  if (!data) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <PageHeader
        title={data.lesson.title}
        description={`Free preview from ${data.courseTitle}`}
        back={{ href: `/courses/${data.courseSlug}`, label: "Back to course" }}
      />
      <LessonContent lesson={data.lesson} resources={data.resources} />
      <div className="mt-8 rounded-xl border bg-card p-4">
        <p className="font-medium">Enjoying this lesson?</p>
        <p className="mt-1 text-sm text-muted-foreground">Enroll to unlock the full course and track your progress.</p>
        <LinkButton href={`/courses/${data.courseSlug}`} className="mt-3">
          View the course
        </LinkButton>
      </div>
    </div>
  );
}

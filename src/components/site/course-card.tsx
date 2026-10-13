import Link from "next/link";
import { BookOpen, Clock, Users } from "lucide-react";
import { ProgressBar } from "@/components/kit/primitives";
import { Tilt } from "@/components/kit/tilt";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatMoney, titleCase } from "@/lib/format";
import type { CourseCardData } from "@/server/queries/catalog";

export function CourseThumb({ fileId, title, className }: { fileId: string | null; title: string; className?: string }) {
  if (fileId) {
    return (
      // Thumbnails are served through the authorizing file route, so the
      // image optimizer (which cannot forward a session) is not used here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/${fileId}`}
        alt=""
        loading="lazy"
        decoding="async"
        className={`aspect-video w-full bg-muted object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex aspect-video w-full items-center justify-center bg-accent text-3xl font-semibold text-accent-foreground/60 ${className ?? ""}`}
    >
      {title.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function CourseCard({ course, href, progress }: { course: CourseCardData; href?: string; progress?: number }) {
  return (
    <Tilt className="h-full">
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <CourseThumb fileId={course.thumbnailFileId} title={course.title} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {course.categoryName && <Badge variant="secondary">{course.categoryName}</Badge>}
          <span>{titleCase(course.level)}</span>
        </div>
        <h3 className="leading-snug font-semibold">
          <Link href={href ?? `/courses/${course.slug}`} className="after:absolute after:inset-0 hover:underline">
            {course.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{course.shortDescription}</p>
        <p className="text-xs text-muted-foreground">By {course.instructorName}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="size-3.5" aria-hidden />
            {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatDuration(course.estimatedMinutes)}
          </span>
          {course.enrolledCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              {course.enrolledCount}
            </span>
          )}
        </div>
        {progress === undefined ? (
          <p className="text-sm font-semibold">{formatMoney(course.priceCents, course.currency)}</p>
        ) : (
          <ProgressBar value={progress} label={`Progress in ${course.title}`} />
        )}
      </div>
    </article>
    </Tilt>
  );
}

export function CourseGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

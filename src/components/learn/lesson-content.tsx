import { Download, ExternalLink, FileText } from "lucide-react";
import { Markdown } from "@/components/kit/primitives";
import { VideoPlayer } from "./video-player";

type Resource = { id: string; title: string; kind: "file" | "link"; fileId: string | null; url: string | null };

/** Turns a YouTube or Vimeo page URL into its privacy-friendly embed URL. */
export function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function LessonContent({
  lesson,
  resources,
  videoPosition = 0,
  track = false,
}: {
  lesson: { id: string; title: string; content: string; videoUrl: string | null; videoFileId: string | null };
  resources: Resource[];
  videoPosition?: number;
  track?: boolean;
}) {
  const embed = lesson.videoUrl ? embedUrl(lesson.videoUrl) : null;
  const direct = lesson.videoUrl && !embed && /\.(mp4|webm)(\?.*)?$/i.test(lesson.videoUrl) ? lesson.videoUrl : null;

  return (
    <div className="space-y-6">
      {lesson.videoFileId ? (
        <VideoPlayer src={`/api/files/${lesson.videoFileId}`} lessonId={lesson.id} startAt={videoPosition} track={track} />
      ) : embed ? (
        <iframe
          src={embed}
          title={`Video: ${lesson.title}`}
          loading="lazy"
          allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="aspect-video w-full rounded-lg border bg-black"
        />
      ) : direct ? (
        <VideoPlayer src={direct} lessonId={lesson.id} startAt={videoPosition} track={track} />
      ) : lesson.videoUrl ? (
        <a
          href={lesson.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
        >
          <ExternalLink className="size-4" aria-hidden />
          Open the lesson video
        </a>
      ) : null}

      {lesson.content.trim() !== "" && <Markdown>{lesson.content}</Markdown>}

      {resources.length > 0 && (
        <section aria-labelledby="resources-heading">
          <h2 id="resources-heading" className="mb-2 text-base font-semibold">
            Resources
          </h2>
          <ul className="divide-y rounded-lg border">
            {resources.map((resource) => (
              <li key={resource.id}>
                <a
                  href={resource.kind === "file" ? `/api/files/${resource.fileId}?download=1` : (resource.url ?? "#")}
                  {...(resource.kind === "link" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted"
                >
                  {resource.kind === "file" ? (
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate">{resource.title}</span>
                  {resource.kind === "file" && <Download className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

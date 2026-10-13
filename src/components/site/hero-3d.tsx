import { Award, GraduationCap, PlayCircle } from "lucide-react";

/**
 * Decorative 3D illustration for the homepage: three layered panels (a
 * lesson, an assessment, a certificate) floating in perspective. It carries
 * no information, so it is hidden from assistive technology and shows no
 * numbers that could be mistaken for real statistics.
 */
export function Hero3D() {
  return (
    <div className="scene-3d mx-auto hidden w-full max-w-md lg:block" aria-hidden>
      <div className="scene-stack">
        <div className="scene-layer scene-layer-back">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-primary" />
            <span className="h-2.5 w-28 rounded-full bg-foreground/15" />
          </div>
          <div className="mt-4 space-y-2">
            <span className="block h-2 w-full rounded-full bg-foreground/10" />
            <span className="block h-2 w-2/3 rounded-full bg-foreground/10" />
          </div>
        </div>

        <div className="scene-layer scene-layer-mid">
          <div className="flex items-center gap-2">
            <span className="size-4 rounded-full border-2 border-primary" />
            <span className="h-2.5 w-36 rounded-full bg-foreground/15" />
          </div>
          <div className="mt-3 grid gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <span className={`size-3 rounded-full ${i === 1 ? "bg-primary" : "border border-foreground/30"}`} />
                <span className="h-2 flex-1 rounded-full bg-foreground/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="scene-layer scene-layer-front">
          <div className="flex aspect-video items-center justify-center rounded-lg bg-primary/90 text-primary-foreground">
            <PlayCircle className="size-10" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </span>
            <span className="h-2.5 w-32 rounded-full bg-foreground/20" />
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="scene-progress h-full rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Tilts its content toward the mouse pointer in 3D. Purely decorative:
 * it ignores touch input, and the CSS disables it entirely for people who
 * prefer reduced motion.
 */
export function Tilt({
  children,
  className,
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  /** Maximum rotation in degrees. */
  max?: number;
}) {
  const inner = useRef<HTMLDivElement>(null);

  function reset() {
    inner.current?.style.setProperty("--rx", "0deg");
    inner.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      className={cn("tilt", className)}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || !inner.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        inner.current.style.setProperty("--rx", `${(-y * max).toFixed(2)}deg`);
        inner.current.style.setProperty("--ry", `${(x * max).toFixed(2)}deg`);
      }}
      onPointerLeave={reset}
    >
      <div ref={inner} className="tilt-inner h-full">
        {children}
      </div>
    </div>
  );
}

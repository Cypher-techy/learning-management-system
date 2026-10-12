"use client";

import { useEffect, useRef } from "react";
import { videoPositionAction } from "@/app/actions/learner";

/**
 * HTML5 player for uploaded or directly linked video files. `preload` is kept
 * to metadata so nothing heavy downloads until the learner presses play, and
 * the position is saved periodically so the lesson resumes where it stopped.
 */
export function VideoPlayer({
  src,
  lessonId,
  startAt = 0,
  track = false,
}: {
  src: string;
  lessonId: string;
  startAt?: number;
  /** Persist the playback position (enrolled learners only). */
  track?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(startAt);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const restore = () => {
      if (startAt > 0 && startAt < (video.duration || Infinity) - 5) video.currentTime = startAt;
    };
    video.addEventListener("loadedmetadata", restore, { once: true });
    if (!track) return () => video.removeEventListener("loadedmetadata", restore);

    const save = () => {
      const now = Math.floor(video.currentTime);
      if (Math.abs(now - lastSaved.current) < 5) return;
      lastSaved.current = now;
      void videoPositionAction(lessonId, now);
    };
    const interval = window.setInterval(() => !video.paused && save(), 15_000);
    video.addEventListener("pause", save);
    return () => {
      window.clearInterval(interval);
      video.removeEventListener("pause", save);
      video.removeEventListener("loadedmetadata", restore);
    };
  }, [lessonId, startAt, track]);

  return (
    <video ref={ref} src={src} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black">
      Your browser cannot play this video.
    </video>
  );
}

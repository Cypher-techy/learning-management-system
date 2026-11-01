"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const BOOT_KEY = "elimu_bora_booted_v3";
const LOGO_FILL_MS = 5200;
const LOGO_COMPLETE_MS = 800;
const LOGO_HOLD_MS = 1400;
const LOGO_EXIT_MS = 750;
const LOGO_FAILSAFE_MS = 9800;

/** Branded startup experience — initial load only (once per browser session).
 *  The Elimu Bora logo starts in black & white and fills with colour
 *  left-to-right over a deliberately prolonged intro (about 8.2 seconds when
 *  the app is ready on time). Progress eases to 90% while the app loads and
 *  only reaches 100% when it is actually ready. */
export default function Splash() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const finishRef = useRef<((quick?: boolean) => void) | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(BOOT_KEY)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(BOOT_KEY, "1");
      return;
    }
    setShow(true);

    let raf = 0;
    let finished = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const setP = (v: number) => {
      progressRef.current = v;
      setProgress(v);
    };

    // Phase 1 — ease towards 90% while the app is still loading. A
    // smootherstep curve keeps the colour filling through the full intro
    // instead of rushing most of the logo in during the first second.
    const start = performance.now();
    const tick = (now: number) => {
      if (finished) return;
      const t = Math.min((now - start) / LOGO_FILL_MS, 1);
      const eased = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
      setP(Math.round(eased * 90));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = (quick = false) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      // Phase 2 — app is ready: sweep the colour to a full 100%.
      const from = progressRef.current;
      const completeStart = performance.now();
      const completeDuration = quick ? 180 : LOGO_COMPLETE_MS;
      const holdDuration = quick ? 100 : LOGO_HOLD_MS;
      const complete = (now: number) => {
        const t = Math.min((now - completeStart) / completeDuration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setP(Math.round(from + (100 - from) * eased));
        if (t < 1) {
          raf = requestAnimationFrame(complete);
        } else {
          // Let the finished logo breathe for a moment, then open the site.
          timers.push(setTimeout(() => {
            setLeaving(true);
            sessionStorage.setItem(BOOT_KEY, "1");
            timers.push(setTimeout(() => setShow(false), LOGO_EXIT_MS));
          }, holdDuration));
        }
      };
      raf = requestAnimationFrame(complete);
    };
    finishRef.current = finish;

    const minWait = new Promise((r) => setTimeout(r, LOGO_FILL_MS));
    const loaded = document.readyState === "complete"
      ? Promise.resolve()
      : new Promise((r) => window.addEventListener("load", r, { once: true }));
    Promise.all([minWait, loaded]).then(() => finish(false));
    const failsafe = setTimeout(() => finish(true), LOGO_FAILSAFE_MS); // never trap the user
    timers.push(failsafe);

    return () => {
      finished = true;
      finishRef.current = null;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!show) return null;
  const colour = progress / 100;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#030304] transition-all duration-[750ms] ${leaving ? "pointer-events-none -translate-y-6 opacity-0" : "opacity-100"}`}
      role="status"
      aria-label="Loading Elimu Bora"
    >
      {/* Ambient background: starts muted, gains saturation as the logo colours */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden transition-[filter] duration-300"
        style={{ filter: `saturate(${colour})`, opacity: 0.35 + colour * 0.65 }}
      >
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-500/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600/25 blur-[120px]" />
        <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 1440 800" preserveAspectRatio="none">
          <path d="M-50 620 C 300 520, 620 720, 900 600 S 1350 420, 1500 500" stroke="#2563eb" strokeWidth="1.5" fill="none" />
          <path d="M-50 180 C 320 260, 700 60, 1050 170 S 1400 300, 1500 240" stroke="#7c3aed" strokeWidth="1.5" fill="none" opacity=".6" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Logo: grayscale base + colour layer revealed left-to-right with progress */}
        <div
          className="relative h-52 w-52 overflow-hidden rounded-[2rem] sm:h-64 sm:w-64"
          style={{
            transform: `scale(${0.97 + colour * 0.03})`,
            boxShadow: `0 0 ${30 + colour * 50}px -10px rgba(79,70,229,${0.15 + colour * 0.45})`,
          }}
        >
          {/* Black & white layer */}
          <Image
            src="/brand/elimu-bora-logo.png"
            alt=""
            fill
            priority
            className="object-cover grayscale contrast-125"
            aria-hidden="true"
          />
          {/* Colour layer, clipped to the loaded percentage */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
            aria-hidden="true"
          >
            <Image src="/brand/elimu-bora-logo.png" alt="Elimu Bora" fill priority className="object-cover" />
          </div>
          {/* Soft sheen at the colour frontier while loading */}
          {progress < 100 && (
            <div
              className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent blur-[2px]"
              style={{ left: `calc(${progress}% - 20px)` }}
              aria-hidden="true"
            />
          )}
        </div>

        {/* Progress bar driven by the same progress value */}
        <div
          className="mt-10 h-1.5 w-64 overflow-hidden rounded-full bg-white/10 sm:w-80"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading progress"
        >
          <div className="h-full rounded-full grad-bg" style={{ width: `${progress}%` }} />
        </div>
        <p className="type-body-sm mt-4 text-slate-400">
          {progress < 100 ? "Loading your learning experience…" : "Karibu — welcome to Elimu Bora"}
          <span className="type-numeric ml-2 font-semibold text-slate-200">{progress}%</span>
        </p>
      </div>
      {!leaving && (
        <button
          type="button"
          onClick={() => finishRef.current?.(true)}
          className="type-eyebrow absolute bottom-6 right-6 rounded-full border border-white/15 px-4 py-2 text-slate-400 transition hover:border-white/35 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          Skip intro
        </button>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

/** Branded startup experience — initial load only (once per browser session),
 *  tied to real window readiness, never shown on in-app navigation. */
export default function Splash() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("edvora_booted")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { sessionStorage.setItem("edvora_booted", "1"); return; }
    setShow(true);
    const finish = () => { setLeaving(true); sessionStorage.setItem("edvora_booted", "1"); setTimeout(() => setShow(false), 650); };
    const minWait = new Promise(r => setTimeout(r, 1500));
    const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise(r => window.addEventListener("load", r, { once: true }));
    Promise.all([minWait, loaded]).then(finish);
    const failsafe = setTimeout(finish, 4000); // never trap the user
    return () => clearTimeout(failsafe);
  }, []);
  if (!show) return null;
  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#02030a] transition-all duration-700 ${leaving ? "pointer-events-none -translate-y-6 opacity-0" : "opacity-100"}`} role="status" aria-label="Loading EDVORA">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-500/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600/25 blur-[120px]" />
        <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 1440 800" preserveAspectRatio="none"><path d="M-50 620 C 300 520, 620 720, 900 600 S 1350 420, 1500 500" stroke="#2563eb" strokeWidth="1.5" fill="none" /><path d="M-50 180 C 320 260, 700 60, 1050 170 S 1400 300, 1500 240" stroke="#7c3aed" strokeWidth="1.5" fill="none" opacity=".6" /></svg>
      </div>
      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="pulse-glow overflow-hidden rounded-[2rem] shadow-glow">
          <Image src="/brand/edvora-logo.png" alt="EDVORA" width={300} height={300} priority className="h-52 w-52 object-cover sm:h-64 sm:w-64" />
        </div>
        <div className="mt-10 h-1.5 w-64 overflow-hidden rounded-full bg-white/10 sm:w-80">
          <div className="splash-bar h-full rounded-full grad-bg" />
        </div>
        <p className="mt-4 text-sm text-slate-400">Loading your learning experience…</p>
      </div>
    </div>
  );
}

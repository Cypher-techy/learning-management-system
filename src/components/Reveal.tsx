"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function Reveal({ children, delay = 0, y = 44, className = "" }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { ref.current.style.opacity = "1"; return; }
    gsap.registerPlugin(ScrollTrigger);
    const tween = gsap.fromTo(ref.current, { opacity: 0, y }, {
      opacity: 1, y: 0, duration: 1, delay, ease: "power3.out",
      scrollTrigger: { trigger: ref.current, start: "top 88%", once: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [delay, y]);
  return <div ref={ref} className={`reveal-init ${className}`}>{children}</div>;
}

export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { ref.current.textContent = value.toLocaleString() + suffix; return; }
    gsap.registerPlugin(ScrollTrigger);
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: value, duration: 1.8, ease: "power2.out",
      scrollTrigger: { trigger: ref.current, start: "top 92%", once: true },
      onUpdate: () => { if (ref.current) ref.current.textContent = Math.round(obj.v).toLocaleString() + suffix; },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [value, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

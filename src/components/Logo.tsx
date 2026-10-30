import Link from "next/link";

export function Emblem({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" className="shrink-0 drop-shadow-[0_4px_14px_rgba(79,70,229,.45)]">
      <defs>
        <linearGradient id="edv-g1" x1="0" y1="0" x2="100" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" /><stop offset=".45" stopColor="#2563eb" /><stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="edv-g2" x1="0" y1="20" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" /><stop offset=".5" stopColor="#4f46e5" /><stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <path d="M18 34c0-12 9-19 24-21l44-6c-3 12-11 22-25 24l-43 7v-4Z" fill="url(#edv-g1)" />
      <path d="M17 55c-1-11 7-18 20-20l38-6c-2 11-9 20-22 22l-36 7v-3Z" fill="url(#edv-g2)" />
      <path d="M18 62c1 15 13 24 29 23 16-1 29-11 34-26l-41 8c-9 2-17 0-22-5Z" fill="url(#edv-g2)" />
      <path d="M18 34v28c-4-4-7-16 0-28Z" fill="#0ea5e9" opacity=".55" />
    </svg>
  );
}
export function Logo({ dark = true, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="EDVORA home">
      <Emblem />
      <span className="leading-none">
        <span className={`block text-lg font-extrabold tracking-[0.28em] ${dark ? "text-white" : "text-navy-900"}`}>EDVOR<span className="inline-block -translate-y-[1px]">Λ</span></span>
        <span className={`mt-1 block text-[8.5px] font-semibold tracking-[0.32em] ${dark ? "text-slate-400" : "text-slate-500"}`}>LEARN BEYOND LIMITS.</span>
      </span>
    </Link>
  );
}

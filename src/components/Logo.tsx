import Image from "next/image";
import Link from "next/link";

export function Emblem({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-[24%] bg-white shadow-[0_6px_18px_rgba(37,99,235,0.35)] ring-1 ring-white/30"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src="/brand/elimu-bora-mark.png"
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
        priority={size >= 48}
      />
    </span>
  );
}

export function Logo({ dark = true, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Elimu Bora home">
      <Emblem />
      <span className="leading-none">
        <span className={`block text-[17px] font-black tracking-[0.14em] ${dark ? "text-white" : "text-navy-900"}`}>
          ELIMU <span className="grad-text">Bora</span>
        </span>
        <span className={`mt-1 block text-[7.5px] font-semibold tracking-[0.28em] ${dark ? "text-slate-400" : "text-slate-500"}`}>
          LEARN BEYOND LIMITS
        </span>
      </span>
    </Link>
  );
}

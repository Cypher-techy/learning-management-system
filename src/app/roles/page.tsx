"use client";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { GraduationCap, Presentation, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

const ROLES = [
  { id: "student", title: "Student", icon: <GraduationCap size={30} />, desc: "Learn, explore courses and develop new skills.", points: ["Instant verification", "Free & premium courses", "Certificates"] },
  { id: "tutor", title: "Tutor", icon: <Presentation size={30} />, desc: "Share knowledge, teach students and earn through educational content.", points: ["Verified application", "Course studio", "Monthly earnings"] },
];

export default function Roles() {
  return (
    <div className="noise relative min-h-screen overflow-hidden bg-navy-950 text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-96 w-96 rounded-full bg-brand-500/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-violet-600/25 blur-[120px]" />
      <header className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo /><Link href="/" className="font-display text-body-sm font-semibold leading-snug text-slate-300 hover:text-white">← Back to website</Link>
      </header>
      <main className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-8 lg:grid-cols-12 lg:px-8 lg:pt-14">
        <div className="lg:col-span-5">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="w-fit overflow-hidden rounded-[1.6rem] shadow-glow"><Image src="/brand/elimu-bora-logo.png" alt="Elimu Bora" width={340} height={340} className="h-44 w-44 object-cover lg:h-56 lg:w-56" /></div>
            <h1 className="type-h1 mt-8">Welcome to <span className="grad-text">Elimu Bora</span></h1>
            <p className="type-lead mt-4 max-w-md text-slate-300">Choose your account type to register or sign in. Each account has its own secure workspace.</p>
            <p className="type-eyebrow mt-6 text-brand-300">Learn Beyond Limits.</p>
          </motion.div>
        </div>
        <div className="space-y-4 lg:col-span-7">
          {ROLES.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.15 + i * 0.12 }}>
              <Link href={`/auth/${r.id}`} className="glass group flex flex-col gap-4 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:shadow-glow sm:flex-row sm:items-center lg:p-7">
                <span className="grad-bg flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-glow">{r.icon}</span>
                <span className="flex-1">
                  <span className="type-h5 flex items-center gap-2">{r.title}<ArrowRight size={19} className="text-brand-300 transition group-hover:translate-x-1.5" /></span>
                  <span className="type-body-sm mt-1 block text-slate-300">{r.desc}</span>
                  <span className="mt-3 flex flex-wrap gap-1.5">{r.points.map(p => <span key={p} className="chip bg-white/10 text-brand-300">{p.toUpperCase()}</span>)}</span>
                </span>
                <span className="flex shrink-0 gap-2 font-display text-xs font-semibold leading-tight"><span className="rounded-full grad-bg px-4 py-2.5">Register</span><span className="rounded-full border border-white/25 px-4 py-2.5">Sign In</span></span>
              </Link>
            </motion.div>
          ))}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="type-caption pt-2 text-center text-slate-400">Protected by server-side role verification. Your actual account type is always confirmed against our records after sign-in.</motion.p>
        </div>
      </main>
    </div>
  );
}

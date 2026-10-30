"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Crown, Smartphone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, kes } from "@/lib/client";

const FREE = ["All designated free courses", "Video lessons & study materials", "Basic quizzes & assignments", "Progress tracking & bookmarks", "Community discussions", "Learning history"];
const PRO = ["Every eligible premium course — one subscription", "Premium downloads & resources", "Advanced learning analytics", "AI study assistant allowances", "Premium certificates & learning paths", "New premium courses as they launch"];

export default function Plans() {
  const [me, setMe] = useState<any>(null);
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user));
    api("/api/overview/student").then(d => setPrice(d.settings.premiumPriceKES)).catch(() => setPrice(499));
  }, []);
  return (
    <>
      <Navbar />
      <section className="bg-navy-950 pb-20 pt-36 text-center text-white">
        <div className="mx-auto max-w-3xl px-5">
          <span className="glass chip !px-4 !py-2 text-brand-300"><Crown size={13} /> SUBSCRIPTION PLANS</span>
          <h1 className="mt-6 text-4xl font-extrabold lg:text-5xl">Simple pricing.<br /><span className="grad-text">All-access learning.</span></h1>
          <p className="mt-4 text-slate-300">Start free forever. Upgrade once to unlock every premium course on EDVORA — no per-course payments, ever.</p>
        </div>
      </section>
      <section className="mx-auto -mt-10 grid max-w-5xl gap-6 px-5 pb-20 md:grid-cols-2">
        <div className="card p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Free</p>
          <p className="mt-3 text-5xl font-extrabold">KSh 0<span className="text-base font-medium text-slate-400"> / forever</span></p>
          <ul className="mt-7 space-y-3 text-sm text-slate-600">{FREE.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-emerald-500" />{x}</li>)}</ul>
          <Link href={me ? "/dashboard/student" : "/roles"} className="btn-dark mt-9 w-full">{me ? "Go to Dashboard" : "Create Free Account"}</Link>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-8 text-white shadow-card">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-violet-600/40 blur-[80px]" />
          <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-300"><Crown size={14} /> Premium — Monthly All-Access</p>
          <p className="relative mt-3 text-5xl font-extrabold">{price ? kes(price) : "—"}<span className="text-base font-medium text-slate-400"> / month</span></p>
          <ul className="relative mt-7 space-y-3 text-sm text-slate-200">{PRO.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-brand-300" />{x}</li>)}</ul>
          <Link href={me ? "/dashboard/student/subscription" : "/roles"} className="btn-primary relative mt-9 w-full"><Smartphone size={17} /> Subscribe with M-Pesa</Link>
          <p className="relative mt-4 text-center text-xs text-slate-400">Pay via M-Pesa STK Push. Access activates on Safaricom confirmation. Renew manually each month — we will remind you before expiry. No automatic charges. Your progress is always preserved, even if you let Premium lapse.</p>
        </div>
      </section>
      <Footer />
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Crown, Smartphone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, usd } from "@/lib/client";

const FREE = ["All designated free courses", "Video lessons & study materials", "Basic quizzes & assignments", "Progress tracking & bookmarks", "Community discussions", "Learning history"];
const PRO = ["Every eligible premium course — one subscription", "Premium downloads & resources", "Advanced learning analytics", "AI study assistant allowances", "Premium certificates & learning paths", "New premium courses as they launch"];

type PlanOption = {
  id: string;
  name: string;
  billingInterval: "monthly" | "annual";
  intervalDays: number;
  priceUSD: number;
  equivalentMonthlyUSD: number;
  billingLabel: string;
  termLabel: string;
};

export default function Plans() {
  const [me, setMe] = useState<any>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [pricingError, setPricingError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)).catch(() => {});
    api("/api/pricing/subscriptions")
      .then(d => setPlans(Array.isArray(d.plans) ? d.plans : []))
      .catch(() => setPricingError("Current USD plan pricing could not be loaded. Please refresh shortly."));
  }, []);

  const monthly = plans.find(plan => plan.billingInterval === "monthly");
  const annual = plans.find(plan => plan.billingInterval === "annual");
  const annualSavingsUSD = monthly && annual ? monthly.priceUSD * 12 - annual.priceUSD : 0;
  const annualSavingsPercent = monthly && annual && annualSavingsUSD > 0
    ? Math.round((annualSavingsUSD / (monthly.priceUSD * 12)) * 100)
    : 0;
  const premiumHref = (interval: "monthly" | "annual") => me ? `/dashboard/student/subscription?interval=${interval}` : "/roles";

  return (
    <>
      <Navbar />
      <section className="bg-navy-950 pb-20 pt-36 text-center text-white">
        <div className="mx-auto max-w-3xl px-5">
          <span className="glass chip !px-4 !py-2 text-brand-300"><Crown size={13} /> SUBSCRIPTION PLANS</span>
          <h1 className="type-h1 mt-6">Simple pricing.<br /><span className="grad-text">All-access learning.</span></h1>
          <p className="type-lead mt-4 text-slate-300">Start free forever, or choose monthly or annual Premium to unlock every eligible premium course on Elimu Bora.</p>
          <p className="type-body-sm mx-auto mt-4 max-w-2xl text-slate-400">Prices are shown in US dollars. M-Pesa charges are made in Kenyan shillings using the latest USD/KES reference rate fetched by our server when you check out.</p>
          {pricingError && <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl bg-rose-500/15 p-3.5 text-sm font-medium text-rose-200">{pricingError}</p>}
        </div>
      </section>

      <section className="mx-auto -mt-10 grid max-w-6xl gap-6 px-5 pb-12 md:grid-cols-2 lg:grid-cols-3">
        <div className="card flex flex-col p-8">
          <p className="type-eyebrow text-slate-500">Free</p>
          <p className="landing-price type-numeric mt-3">{usd(0)}<span className="text-base font-medium text-slate-400"> / forever</span></p>
          <p className="type-body-sm mt-2 text-slate-500">A complete free learning account.</p>
          <ul className="type-body-sm mt-7 flex-1 space-y-3 text-slate-700">{FREE.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-emerald-500" />{x}</li>)}</ul>
          <Link href={me ? "/dashboard/student" : "/roles"} className="btn-dark mt-9 w-full">{me ? "Go to Dashboard" : "Create Free Account"}</Link>
        </div>

        <div className="card flex flex-col border-brand-200 p-8 shadow-card">
          <p className="type-eyebrow flex items-center gap-2 text-brand-700"><Crown size={14} /> Premium — Monthly</p>
          <p className="landing-price type-numeric mt-3">{monthly ? usd(monthly.priceUSD) : "—"}<span className="text-base font-medium text-slate-400"> / month</span></p>
          <p className="type-body-sm mt-2 text-slate-500">{monthly?.billingLabel || "Loading current plan…"}</p>
          <ul className="type-body-sm mt-7 flex-1 space-y-3 text-slate-700">{PRO.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-brand-500" />{x}</li>)}</ul>
          <Link href={premiumHref("monthly")} className="btn-dark mt-9 w-full"><Smartphone size={17} /> Choose Monthly</Link>
          <p className="type-caption mt-4 text-center text-slate-500">Manual M-Pesa renewal every 30 days. No automatic charges.</p>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-navy-900 p-8 text-white shadow-card md:col-span-2 lg:col-span-1">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-violet-600/40 blur-[80px]" />
          <div className="relative flex items-center justify-between gap-3">
            <p className="type-eyebrow flex items-center gap-2 text-brand-300"><Crown size={14} /> Premium — Annual</p>
            {annualSavingsPercent > 0 && <span className="chip grad-bg text-white">SAVE {annualSavingsPercent}%</span>}
          </div>
          <p className="landing-price type-numeric relative mt-3">{annual ? usd(annual.priceUSD) : "—"}<span className="text-base font-medium text-slate-400"> / year</span></p>
          <p className="type-body-sm relative mt-2 text-slate-300">
            {annual ? `${usd(annual.equivalentMonthlyUSD)}/month billed annually` : "Loading current plan…"}
            {annualSavingsUSD > 0 ? ` · Save ${usd(annualSavingsUSD)} over 12 monthly payments` : ""}
          </p>
          <ul className="type-body-sm relative mt-7 flex-1 space-y-3 text-slate-200">{PRO.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-brand-300" />{x}</li>)}</ul>
          <Link href={premiumHref("annual")} className="btn-primary relative mt-9 w-full"><Smartphone size={17} /> Choose Annual</Link>
          <p className="type-caption relative mt-4 text-center text-slate-400">One M-Pesa payment for 365 days. Renew manually before expiry.</p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-20 text-center">
        <div className="card p-6 sm:p-8">
          <h2 className="type-h5">How USD pricing works with M-Pesa</h2>
          <p className="type-body-sm mx-auto mt-3 max-w-2xl text-slate-600">
            You view and compare Premium in USD. When you transact, Elimu Bora fetches the latest USD/KES reference rate on the server,
            converts the selected plan to whole Kenyan shillings, and shows that exact KSh amount before you approve the M-Pesa STK prompt.
            The rate, rate date, USD price and charged KSh amount are saved with your payment record.
          </p>
          <p className="type-caption mx-auto mt-4 max-w-2xl text-slate-500">
            Access activates only after Safaricom confirms payment. There are no silent recurring charges; if you do not renew,
            Premium stays active until the end of the period you paid for and your learning progress is preserved.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}

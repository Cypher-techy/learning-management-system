"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Crown, Smartphone } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseCard from "@/components/CourseCard";
import { api, kesToUsd, useUsdKesRate, usdPrice } from "@/lib/client";

const FREE = ["All designated free courses", "Video lessons & study materials", "Quizzes & assignments", "Progress tracking & bookmarks", "Community discussions", "Learning history"];
const PREMIUM = ["Pay only for the course you choose", "Lifetime access to that course", "Premium lessons, downloads & resources", "Quizzes, assignments & tutor discussions", "Study assistant using the course materials", "Verifiable certificate on completion"];

export default function Plans() {
  const [me, setMe] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [coursesError, setCoursesError] = useState("");
  const { fx, rate, loading: fxLoading, error: fxError } = useUsdKesRate();

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)).catch(() => {});
    api("/api/courses?access=premium&sort=popular")
      .then(d => setCourses(Array.isArray(d.courses) ? d.courses : []))
      .catch(() => setCoursesError("Current premium courses could not be loaded. Please refresh shortly."));
  }, []);

  const prices = courses.map(c => Number(c.priceKES)).filter(n => Number.isFinite(n) && n > 0);
  const minUSD = prices.length && rate ? kesToUsd(Math.min(...prices), rate) : 0;
  const maxUSD = prices.length && rate ? kesToUsd(Math.max(...prices), rate) : 0;
  const rangeLabel = fxLoading
    ? "Loading live USD prices…"
    : fxError || !rate
      ? "Live USD conversion unavailable"
      : prices.length
        ? minUSD === maxUSD ? usdPrice(minUSD) : `${usdPrice(minUSD)}–${usdPrice(maxUSD)}`
        : "Individually priced";
  const studentDashboard = me?.role === "student" ? "/dashboard/student/purchases" : "/explore?access=premium";

  return (
    <>
      <Navbar />
      <section className="bg-navy-950 pb-20 pt-36 text-center text-white">
        <div className="mx-auto max-w-3xl px-5">
          <span className="glass chip !px-4 !py-2 text-brand-300"><Crown size={13} /> COURSE PRICING</span>
          <h1 className="type-h1 mt-6">Pay per course.<br /><span className="grad-text">Keep it for life.</span></h1>
          <p className="type-lead mt-4 text-slate-300">Start free, then buy each premium course independently. No Elimu Bora subscription, no monthly renewal and no recurring charge.</p>
          <p className="type-body-sm mx-auto mt-4 max-w-2xl text-slate-400">Course prices are written in US dollars using the latest available exchange rate. M-Pesa settles in Kenyan shillings, and the exact shilling amount for the selected course is shown before you approve the STK prompt.</p>
          {coursesError && <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl bg-rose-500/15 p-3.5 text-sm font-medium text-rose-200">{coursesError}</p>}
        </div>
      </section>

      <section className="mx-auto -mt-10 grid max-w-5xl gap-6 px-5 pb-12 md:grid-cols-2">
        <div className="card flex flex-col p-8">
          <p className="type-eyebrow text-slate-500">Free courses</p>
          <p className="landing-price type-numeric mt-3">{usdPrice(0)}<span className="text-base font-medium text-slate-400"> / course</span></p>
          <p className="type-body-sm mt-2 text-slate-500">A complete free learning account — no payment details required.</p>
          <ul className="type-body-sm mt-7 flex-1 space-y-3 text-slate-700">{FREE.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-emerald-500" />{x}</li>)}</ul>
          <Link href={me?.role === "student" ? "/dashboard/student" : "/roles"} className="btn-dark mt-9 w-full">{me ? "Go to Dashboard" : "Create Free Account"}</Link>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-navy-900 p-8 text-white shadow-card">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-violet-600/40 blur-[80px]" />
          <div className="relative flex items-center justify-between gap-3">
            <p className="type-eyebrow flex items-center gap-2 text-brand-300"><Crown size={14} /> Premium courses</p>
            <span className="chip grad-bg text-white">LIFETIME</span>
          </div>
          <p className="landing-price type-numeric relative mt-3">{rangeLabel}<span className="text-base font-medium text-slate-400"> / course</span></p>
          <p className="type-body-sm relative mt-2 text-slate-300">
            Current published premium-course range at the latest rate{fx?.rateDate ? ` dated ${new Date(fx.rateDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}` : ""}. Each course shows its own exact price.
          </p>
          <ul className="type-body-sm relative mt-7 flex-1 space-y-3 text-slate-200">{PREMIUM.map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="shrink-0 text-brand-300" />{x}</li>)}</ul>
          <Link href={studentDashboard} className="btn-primary relative mt-9 w-full"><Smartphone size={17} /> Browse Premium Courses</Link>
          <p className="type-caption relative mt-4 text-center leading-5 text-slate-400">One M-Pesa payment per course. Access activates only after Safaricom confirms that payment.</p>
        </div>
      </section>

      {courses.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-16 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="type-h3">Current premium courses</h2>
              <p className="type-body-sm mt-2 text-slate-500">Every price below is for that course only and includes lifetime access after verified payment.</p>
            </div>
            <Link href="/explore?access=premium" className="btn-dark">View in Catalogue</Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map(course => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-4xl px-5 pb-20 text-center">
        <div className="card p-6 sm:p-8">
          <h2 className="type-h5">How course pricing works</h2>
          <p className="type-body-sm mx-auto mt-3 max-w-2xl leading-6 text-slate-600">
            A course’s tutor — or the super admin — sets its price before the course is published. Regular administrators review the course for quality and safety but cannot change its price.
            The whole-shilling M-Pesa amount is stored on the course record, while the price you see is displayed in USD from the latest server-fetched exchange rate.
          </p>
          <p className="type-caption mx-auto mt-4 max-w-2xl leading-5 text-slate-500">
            A confirmed payment enrols you and grants lifetime access to that one course. Failed or unconfirmed payments grant nothing, and your progress remains saved. Any all-access subscription bought under the former model remains honoured until its original expiry date, but new subscriptions are no longer sold.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}

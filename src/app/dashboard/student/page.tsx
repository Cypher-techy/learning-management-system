"use client";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, Crown, Flame, ReceiptText, Trophy } from "lucide-react";
import { useApi, fmtDate } from "@/lib/client";
import { Stat, Loading, ProgressBar } from "@/components/ui";
import CourseCard from "@/components/CourseCard";

export default function StudentHome() {
  const { data, loading, error } = useApi("/api/overview/student");
  if (loading) return <Loading text="Loading your dashboard…" />;
  if (error || !data) return <p className="text-rose-600">{error}</p>;
  const u = data.user; const s = data.stats;
  const legacySub = data.legacySubscription || data.subscription;
  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-navy-900 p-7 text-white lg:p-9">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-violet-600/40 blur-[80px]" />
        <p className="type-body-sm relative text-slate-300">Karibu tena,</p>
        <h1 className="type-h3 relative mt-1">{u.fullName.split(" ")[0]} — let's keep learning.</h1>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <span className={`chip ${u.premiumActive || (s.purchasedCourses || 0) > 0 ? "grad-bg text-white" : "bg-white/15 text-white"}`}>{u.premiumActive ? "LEGACY PREMIUM ACTIVE" : (s.purchasedCourses || 0) > 0 ? "COURSE OWNER" : "FREE ACCOUNT"}</span>
          <span className="chip bg-white/15 text-white"><ReceiptText size={12} /> {s.purchasedCourses || 0} COURSE{(s.purchasedCourses || 0) === 1 ? "" : "S"} OWNED FOR LIFE</span>
          <span className="chip bg-white/15 text-white"><Flame size={12} /> {s.lessonsDone} LESSONS COMPLETED</span>
          {u.premiumActive && legacySub && <span className="chip bg-white/15 text-white">LEGACY ACCESS UNTIL {fmtDate(legacySub.expiresAt).toUpperCase()}</span>}
        </div>
        <Link href="/dashboard/student/purchases" className="btn-primary relative mt-6"><Crown size={16} /> {u.premiumActive ? "View Purchases & Payments" : "Buy Premium Courses Individually"}</Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Enrolled Courses" value={s.enrolled} icon={<BookOpen size={19} />} />
        <Stat label="Completed" value={s.completed} icon={<CheckCircle2 size={19} />} />
        <Stat label="Learning Hours" value={s.learningHours} sub="Tracked active learning time" icon={<Clock3 size={19} />} />
        <Stat label="Certificates" value={s.certificates} icon={<Trophy size={19} />} />
      </div>

      {data.inProgress.length > 0 && (
        <>
          <h2 className="type-h4 mb-4 mt-10">Continue learning</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {data.inProgress.map((c: any) => (
              <Link key={c.id} href={`/courses/${c.id}/learn`} className="card group flex gap-4 p-4 transition hover:shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt={c.title} className="h-24 w-32 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1"><p className="type-eyebrow text-brand-700">{c.category}</p>
                  <h3 className="type-card-title mt-1 line-clamp-2 group-hover:text-brand-600">{c.title}</h3>
                  <div className="mt-3 flex items-center gap-3"><ProgressBar value={c.progress} className="flex-1" /><span className="type-caption type-numeric font-semibold">{c.progress}%</span></div>
                  <p className="type-caption type-numeric mt-1.5 text-slate-600">{c.completedLessons} of {c.totalLessons} lessons</p></div>
              </Link>
            ))}
          </div>
        </>
      )}

      {data.announcements?.length > 0 && (
        <div className="card mt-10 p-6"><h2 className="type-h5">Announcements</h2>
          {data.announcements.map((a: any) => <div key={a.id} className="mt-3 border-l-4 border-brand-500 bg-slate-50 p-4"><p className="font-display text-body-sm font-semibold leading-snug">{a.title}</p><p className="type-body-sm mt-0.5 text-slate-700">{a.body}</p></div>)}
        </div>
      )}

      <h2 className="type-h4 mb-4 mt-10">Recommended for you</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {data.recommended.map((c: any) => <CourseCard key={c.id} course={{ ...c, lessonCount: c.totalLessons, durationMin: 0 }} />)}
      </div>
    </div>
  );
}

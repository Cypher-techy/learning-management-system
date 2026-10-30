"use client";
import Link from "next/link";
import { BookOpen, CheckCircle2, FileEdit, Star, Users, Wallet } from "lucide-react";
import { useApi, kes } from "@/lib/client";
import { Stat, Loading, StatusChip } from "@/components/ui";

export default function TutorHome() {
  const { data, loading, error } = useApi("/api/overview/tutor");
  if (loading) return <Loading />; if (error || !data) return <p className="text-rose-600">{error}</p>;
  const s = data.stats; const w = data.wallet;
  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-navy-900 p-7 text-white lg:p-9">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-500/40 blur-[80px]" />
        <p className="relative text-sm text-slate-300">Tutor workspace</p>
        <h1 className="relative mt-1 text-3xl font-extrabold">Welcome back, {data.user.fullName.split(" ")[0]}.</h1>
        <p className="relative mt-2 max-w-lg text-sm text-slate-300">{data.user.title} · {data.user.expertise}</p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/tutor/courses/new" className="btn-primary">Create New Course</Link>
          <Link href="/dashboard/tutor/earnings" className="btn-ghost border-white/25 text-white hover:bg-white/10">View Earnings</Link>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Courses" value={s.courses} sub={`${s.published} published · ${s.drafts} drafts`} icon={<BookOpen size={19} />} />
        <Stat label="Enrolled Students" value={s.students} icon={<Users size={19} />} />
        <Stat label="Completion Rate" value={`${s.completionRate}%`} sub={`${s.completions} course completions`} icon={<CheckCircle2 size={19} />} />
        <Stat label="Available Balance" value={kes(w.available)} sub={`Total earned ${kes(w.earned)}`} icon={<Wallet size={19} />} />
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        <div className="card p-6 lg:col-span-7">
          <div className="flex items-center justify-between"><h2 className="font-extrabold">Recent courses</h2><Link href="/dashboard/tutor/courses" className="text-sm font-semibold text-brand-600">Manage all →</Link></div>
          <div className="mt-4 space-y-3">
            {data.courses.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate font-bold">{c.title}</p><p className="text-xs text-slate-500">{c.enrolledCount} enrolments · {c.totalLessons} lessons</p></div>
                <StatusChip status={c.status} />
              </div>
            ))}
            {data.courses.length === 0 && <p className="flex items-center gap-2 text-sm text-slate-500"><FileEdit size={16} /> No courses yet — create your first one.</p>}
          </div>
        </div>
        <div className="card p-6 lg:col-span-5">
          <h2 className="flex items-center gap-2 font-extrabold"><Star className="text-amber-400" fill="currentColor" size={18} /> Student feedback {s.avgRating ? `· ${s.avgRating}/5 average` : ""}</h2>
          <div className="mt-4 space-y-3">
            {data.reviews.slice(0, 4).map((r: any) => <div key={r.id} className="rounded-2xl bg-slate-50 p-4"><p className="text-sm font-bold">{r.studentName} <span className="text-amber-500">★ {r.rating}</span></p><p className="mt-1 text-sm text-slate-600">{r.comment}</p><p className="mt-1 text-xs text-slate-400">{r.courseTitle}</p></div>)}
            {data.reviews.length === 0 && <p className="text-sm text-slate-500">Reviews from your students will appear here.</p>}
          </div>
          {data.submissionsToGrade.filter((x: any) => x.status === "submitted").length > 0 && (
            <Link href="/dashboard/tutor/students" className="btn-dark mt-5 w-full">{data.submissionsToGrade.filter((x: any) => x.status === "submitted").length} submission(s) waiting for grading</Link>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Route } from "lucide-react";
import { useApi } from "@/lib/client";
import { Loading, Empty, PageTitle, ProgressBar, StatusChip } from "@/components/ui";

export default function MyLearning() {
  const { data, loading, error } = useApi("/api/overview/student");
  const [tab, setTab] = useState("all");
  if (loading) return <Loading />;
  if (error || !data) return <p className="text-rose-600">{error}</p>;
  const lists: Record<string, any[]> = { all: data.myCourses, progress: data.inProgress, completed: data.completed, saved: data.saved };
  const list = lists[tab] || [];
  const cats: string[] = Array.from(new Set(data.myCourses.map((c: any) => String(c.category))));
  return (
    <div>
      <PageTitle title="My Learning" sub="Enrolled, in-progress, completed and saved courses — resume exactly where you stopped." right={<Link href="/explore" className="btn-dark">Find More Courses</Link>} />
      <div className="mb-6 flex flex-wrap gap-2">
        {[["all", "All"], ["progress", "In Progress"], ["completed", "Completed"], ["saved", "Saved"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? "grad-bg text-white" : "bg-white border border-slate-200"}`}>{l} ({lists[k].length})</button>
        ))}
      </div>
      {list.length === 0 ? <Empty title="Nothing here yet" body="Enrol in a course to see it in your learning workspace." action={<Link href="/explore" className="btn-primary">Explore Courses</Link>} /> : (
        <div className="grid gap-5 md:grid-cols-2">
          {list.map((c: any) => (
            <div key={c.id} className="card flex gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.title} className="h-28 w-36 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><StatusChip status={c.access} /><span className="text-xs text-slate-400">{c.category}</span></div>
                <h3 className="mt-1.5 line-clamp-2 font-bold leading-snug">{c.title}</h3>
                <p className="text-xs text-slate-500">{c.tutorName}</p>
                <div className="mt-3 flex items-center gap-3"><ProgressBar value={c.progress} className="flex-1" /><span className="text-xs font-bold">{c.progress}%</span></div>
                <Link href={`/courses/${c.id}/learn`} className="btn-dark mt-3 !py-2 !text-xs">{c.progress === 100 ? "Review Course" : c.progress > 0 ? "Resume Learning" : "Start Course"}</Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {cats.length > 0 && (
        <div className="card mt-10 p-6">
          <h3 className="flex items-center gap-2 font-extrabold"><Route className="text-brand-500" /> Your learning paths</h3>
          <p className="mt-1 text-sm text-slate-500">EDVORA groups your courses into skill paths by subject. Complete every course in a path to master the track.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {cats.map((cat: string) => {
              const inCat = data.myCourses.filter((c: any) => c.category === cat);
              const avg = Math.round(inCat.reduce((a: number, c: any) => a + c.progress, 0) / inCat.length);
              return <div key={cat} className="rounded-2xl bg-slate-50 p-5"><p className="font-bold">{cat} Path</p><p className="text-xs text-slate-500">{inCat.length} course{inCat.length !== 1 ? "s" : ""} enrolled</p><div className="mt-3 flex items-center gap-3"><ProgressBar value={avg} className="flex-1" /><span className="text-xs font-bold">{avg}%</span></div></div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { CheckCircle2, Circle, Flame, Plus } from "lucide-react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle, ProgressBar } from "@/components/ui";

export default function Planner() {
  const { data, loading, reload } = useApi("/api/overview/student");
  const [title, setTitle] = useState(""); const [hours, setHours] = useState(4);
  if (loading || !data) return <Loading />;
  async function add() { if (!title.trim()) return; await api("/api/goals", { method: "POST", body: JSON.stringify({ title, targetHoursPerWeek: hours }) }); setTitle(""); reload(); }
  async function toggle(g: any) { await api("/api/goals", { method: "PATCH", body: JSON.stringify({ id: g.id, done: !g.done }) }); reload(); }
  const weeklyTargetMin = data.goals.filter((g: any) => !g.done).reduce((a: number, g: any) => a + g.targetHoursPerWeek * 60, 0);
  return (
    <div>
      <PageTitle title="Study Planner" sub="Personal learning goals, weekly targets and your learning rhythm." />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <div className="card p-6">
            <h3 className="font-extrabold">Set a new goal</h3>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input className="input" placeholder="e.g. Finish Python sections 1–2" value={title} onChange={e => setTitle(e.target.value)} />
              <select className="input !w-auto" value={hours} onChange={e => setHours(Number(e.target.value))}>{[2, 3, 4, 5, 6, 8, 10].map(h => <option key={h} value={h}>{h} hrs/week</option>)}</select>
              <button className="btn-primary shrink-0" onClick={add}><Plus size={16} /> Add Goal</button>
            </div>
          </div>
          <div className="space-y-3">
            {data.goals.map((g: any) => (
              <button key={g.id} onClick={() => toggle(g)} className="card flex w-full items-center gap-4 p-5 text-left transition hover:shadow-card">
                {g.done ? <CheckCircle2 className="shrink-0 text-emerald-500" size={24} /> : <Circle className="shrink-0 text-slate-300" size={24} />}
                <span className="flex-1"><span className={`font-bold ${g.done ? "text-slate-400 line-through" : ""}`}>{g.title}</span><span className="block text-xs text-slate-400">Target {g.targetHoursPerWeek} hrs/week · set {fmtDate(g.createdAt)}</span></span>
                <span className={`chip ${g.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{g.done ? "DONE" : "ACTIVE"}</span>
              </button>
            ))}
            {data.goals.length === 0 && <p className="card p-6 text-sm text-slate-500">No goals yet — set your first one above.</p>}
          </div>
        </div>
        <aside className="space-y-5 lg:col-span-5">
          <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white">
            <p className="flex items-center gap-2 font-extrabold"><Flame className="text-amber-400" /> Learning activity</p>
            <p className="mt-4 text-4xl font-extrabold">{data.stats.learningHours}<span className="text-base font-medium text-slate-400"> hrs tracked</span></p>
            <p className="mt-1 text-sm text-slate-300">{data.stats.lessonsDone} lessons completed across {data.stats.enrolled} courses</p>
            <div className="mt-5"><div className="mb-1.5 flex justify-between text-xs"><span>Active weekly target</span><span className="font-bold">{Math.round(weeklyTargetMin / 60)} hrs</span></div><ProgressBar value={weeklyTargetMin ? Math.min(100, (data.stats.learningHours * 60 / Math.max(weeklyTargetMin, 1)) * 100) : 0} className="!bg-white/15" /></div>
          </div>
          <div className="card p-6">
            <h3 className="font-extrabold">Upcoming deadlines</h3>
            {data.assignments.filter((a: any) => !a.submission).length === 0 ? <p className="mt-2 text-sm text-slate-500">No pending assignment deadlines. Well done.</p> :
              data.assignments.filter((a: any) => !a.submission).map((a: any) => <div key={a.id} className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 p-3.5 text-sm"><span className="font-semibold">{a.title}</span><span className="text-xs font-bold text-amber-700">Due {fmtDate(a.dueDate)}</span></div>)}
          </div>
        </aside>
      </div>
    </div>
  );
}

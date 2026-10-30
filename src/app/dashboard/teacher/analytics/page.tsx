"use client";
import { useApi, kes } from "@/lib/client";
import { Loading, PageTitle, Bar, Stat } from "@/components/ui";
export default function Analytics() {
  const { data, loading } = useApi("/api/overview/teacher");
  if (loading || !data) return <Loading />;
  const maxEnr = Math.max(...data.courses.map((c: any) => c.enrolledCount), 1);
  const earnings = data.walletTxs.filter((t: any) => t.type === "earning");
  const maxEarn = Math.max(...earnings.map((t: any) => t.amount), 1);
  return (
    <div>
      <PageTitle title="Instructor Analytics" sub="Enrolments, engagement and revenue contribution — all computed from live platform records." />
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Students Reached" value={data.stats.students} />
        <Stat label="Completion Rate" value={`${data.stats.completionRate}%`} />
        <Stat label="Average Rating" value={data.stats.avgRating ? `${data.stats.avgRating}/5` : "—"} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6"><h3 className="font-extrabold">Enrolments by course</h3>
          {data.courses.map((c: any) => <Bar key={c.id} label={c.title} value={c.enrolledCount} max={maxEnr} />)}
          {data.courses.length === 0 && <p className="text-sm text-slate-500">Publish a course to start collecting analytics.</p>}</div>
        <div className="card space-y-4 p-6"><h3 className="font-extrabold">Monthly earnings allocations</h3>
          {earnings.map((t: any) => <Bar key={t.id} label={t.note.split("—")[0]} value={t.amount} max={maxEarn} />)}
          {earnings.length === 0 && <p className="text-sm text-slate-500">No allocations yet. Earnings are allocated monthly from premium engagement.</p>}
          <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">Total allocated to you: <strong>{kes(data.wallet.earned)}</strong>. Allocation weights completed premium lessons and active learning time — never raw page views.</p></div>
      </div>
    </div>
  );
}

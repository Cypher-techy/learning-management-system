"use client";
import { useApi, kes } from "@/lib/client";
import { Loading, PageTitle, Bar, Stat } from "@/components/ui";
export default function Analytics() {
  const { data, loading } = useApi("/api/overview/tutor");
  if (loading || !data) return <Loading />;
  const maxEnr = Math.max(...data.courses.map((c: any) => c.enrolledCount), 1);
  const earnings = data.walletTxs.filter((t: any) => t.type === "earning");
  const maxEarn = Math.max(...earnings.map((t: any) => t.amount), 1);
  return (
    <div>
      <PageTitle title="Tutor Analytics" sub="Enrolments, engagement and individual course sales — all computed from live platform records." />
      <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-5">
        <Stat label="Students Reached" value={data.stats.students} />
        <Stat label="Completion Rate" value={`${data.stats.completionRate}%`} />
        <Stat label="Average Rating" value={data.stats.avgRating ? `${data.stats.avgRating}/5` : "—"} />
        <Stat label="Course Sales" value={data.stats.courseSales || 0} />
        <Stat label="Sales Gross" value={kes(data.stats.courseSalesGrossKES || 0)} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6"><h3 className="type-h5">Enrolments by course</h3>
          {data.courses.map((c: any) => <Bar key={c.id} label={c.title} value={c.enrolledCount} max={maxEnr} />)}
          {data.courses.length === 0 && <p className="text-sm text-slate-500">Publish a course to start collecting analytics.</p>}</div>
        <div className="card space-y-4 p-6"><h3 className="type-h5">Earnings credits</h3>
          {earnings.map((t: any) => <Bar key={t.id} label={t.note.split("—")[0]} value={t.amount} max={maxEarn} />)}
          {earnings.length === 0 && <p className="text-sm text-slate-500">No earnings yet. Your share is credited after each verified sale of one of your premium courses.</p>}
          <p className="border-t border-slate-100 pt-3 type-caption text-slate-600">Total credited to you: <strong>{kes(data.wallet.earned)}</strong>. New earnings come from verified sales of your own courses; any legacy subscription allocation is labelled separately.</p></div>
      </div>
    </div>
  );
}

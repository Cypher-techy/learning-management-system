"use client";
import { useState } from "react";
import Link from "next/link";
import { api, kes, useApi } from "@/lib/client";
import { Loading, PageTitle, StatusChip } from "@/components/ui";
import { CoursePrice } from "@/components/CoursePrice";

export default function AdminCourses() {
  const { data, loading, reload } = useApi("/api/overview/admin");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (loading || !data) return <Loading />;
  async function act(c: any, action: string) {
    const note = window.prompt(`Moderation note for "${c.title}" (${action}) — shared with the tutor:`, "") ?? null;
    if (note === null) return;
    setMsg(""); setErr("");
    try { await api(`/api/courses/${c.id}`, { method: "PATCH", body: JSON.stringify({ action, note }) }); setMsg(`"${c.title}" — ${action} recorded.`); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  const inReview = data.courses.filter((c: any) => c.status === "in_review");
  const rest = data.courses.filter((c: any) => c.status !== "in_review");
  const Row = ({ c }: { c: any }) => (
    <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="h-24 w-full shrink-0 rounded-xl object-cover sm:w-40" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2"><StatusChip status={c.status} /><StatusChip status={c.access} /><span className="type-caption text-slate-600">{c.category} · by {c.tutorName}</span></div>
        <h3 className="type-card-title mt-2">{c.title}</h3><p className="text-xs text-slate-500">{c.totalLessons} lessons · {c.enrolledCount} enrolments{c.access === "premium" ? ` · ${c.salesCount || 0} sales` : ""}</p>
        <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-5 text-slate-600">
          <strong>Learner price (read-only):</strong> <CoursePrice course={c} className="font-bold text-slate-900" />
          {c.access === "premium" && c.priceConfigured !== false ? <> · Exact M-Pesa charge {kes(c.priceKES || 0)}</> : null}
          {c.access === "premium" && c.priceConfigured === false ? <span className="font-semibold text-amber-700"> · Price not set — this course cannot publish until its tutor or the super admin sets KSh 350–500.</span> : null}
          <span className="block text-slate-500">Pricing authority: course tutor or super admin only, before publication.</span>
        </p>
        {c.moderationNote && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><strong>Note:</strong> {c.moderationNote}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link href={`/courses/${c.id}`} className="btn-light !py-2 !text-xs">Review Content</Link>
        {c.status === "in_review" && <><button disabled={c.access === "premium" && c.priceConfigured === false} title={c.access === "premium" && c.priceConfigured === false ? "The tutor or super admin must set a KSh 350–500 price first" : undefined} className="btn-dark !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-50" onClick={() => act(c, "approve")}>Approve & Publish</button><button className="btn-light !py-2 !text-xs" onClick={() => act(c, "reject")}>Request Changes</button></>}
        {c.status === "published" && <button className="btn-light !py-2 !text-xs" onClick={() => act(c, "unpublish")}>Unpublish</button>}
        <button className="btn-light !py-2 !text-xs" onClick={() => act(c, "feature")}>Toggle Featured</button>
      </div>
    </div>
  );
  return (
    <div>
      <PageTitle title="Course Moderation" sub="Approve, reject and moderate tutor courses. Course pricing is shown for review only — regular administrators cannot set or change it." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <h2 className="mb-4 type-h5">Awaiting review ({inReview.length})</h2>
      <div className="space-y-4">{inReview.map((c: any) => <Row key={c.id} c={c} />)}{inReview.length === 0 && <p className="card p-6 text-sm text-slate-500">Review queue is clear.</p>}</div>
      <h2 className="mb-4 mt-10 type-h5">All other courses</h2>
      <div className="space-y-4">{rest.map((c: any) => <Row key={c.id} c={c} />)}</div>
    </div>
  );
}

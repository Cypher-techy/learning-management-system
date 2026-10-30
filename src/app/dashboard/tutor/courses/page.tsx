"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi, api } from "@/lib/client";
import { Loading, Empty, PageTitle, StatusChip } from "@/components/ui";

export default function TutorCourses() {
  const { data, loading, reload } = useApi("/api/overview/tutor");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (loading || !data) return <Loading />;
  async function act(id: string, action: string) {
    setMsg(""); setErr("");
    try { await api(`/api/courses/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }); setMsg(`Course ${action === "submit" ? "submitted for review" : action + "ed"} successfully.`); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
  }
  return (
    <div>
      <PageTitle title="My Courses" sub="Drafts, moderation status and publishing controls. Courses go live after administrator review." right={<Link href="/dashboard/tutor/courses/new" className="btn-primary">+ New Course</Link>} />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      {data.courses.length === 0 ? <Empty title="No courses yet" body="Build your first course with sections, lessons, quizzes and assignments." action={<Link href="/dashboard/tutor/courses/new" className="btn-primary">Create Course</Link>} /> : (
        <div className="space-y-4">
          {data.courses.map((c: any) => (
            <div key={c.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt="" className="h-24 w-full shrink-0 rounded-xl object-cover sm:w-40" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><StatusChip status={c.status} /><StatusChip status={c.access} /><span className="text-xs text-slate-400">{c.category} · {c.level}</span></div>
                <h3 className="mt-2 font-extrabold">{c.title}</h3>
                <p className="text-xs text-slate-500">{c.totalLessons} lessons · {c.enrolledCount} enrolments</p>
                {c.moderationNote && <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600"><strong>Moderation:</strong> {c.moderationNote}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href={`/courses/${c.id}`} className="btn-light !py-2 !text-xs">Preview</Link>
                {(c.status === "draft" || c.status === "rejected" || c.status === "unpublished") && <button onClick={() => act(c.id, "submit")} className="btn-dark !py-2 !text-xs">Submit for Review</button>}
                {c.status === "published" && <button onClick={() => act(c.id, "unpublish")} className="btn-light !py-2 !text-xs">Unpublish</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

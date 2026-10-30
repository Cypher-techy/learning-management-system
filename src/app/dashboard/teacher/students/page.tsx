"use client";
import { useState } from "react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle, ProgressBar, StatusChip, Empty } from "@/components/ui";

export default function TeacherStudents() {
  const { data, loading, reload } = useApi("/api/overview/teacher");
  const [grades, setGrades] = useState<Record<string, { grade: number; feedback: string }>>({});
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [ann, setAnn] = useState({ title: "", body: "", courseId: "" });
  if (loading || !data) return <Loading />;
  async function grade(id: string) {
    const g = grades[id]; if (!g) { setErr("Enter a grade first."); return; }
    try { await api(`/api/submissions/${id}/grade`, { method: "POST", body: JSON.stringify(g) }); setMsg("Graded and student notified."); setErr(""); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Grading failed"); }
  }
  async function announce() {
    if (!ann.title || !ann.body || !ann.courseId) { setErr("Choose a course and write the announcement."); return; }
    try { const r = await api("/api/admin/announcements", { method: "POST", body: JSON.stringify({ ...ann, audience: "course" }) }); setMsg(`Announcement sent to ${r.deliveredTo} student(s).`); setAnn({ title: "", body: "", courseId: "" }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  const pending = data.submissionsToGrade.filter((s: any) => s.status === "submitted");
  const graded = data.submissionsToGrade.filter((s: any) => s.status === "graded");
  return (
    <div>
      <PageTitle title="Students & Grading" sub="Learners enrolled in your courses, their progress, and assignment grading. You only see students in your own courses." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}

      <div className="card p-6">
        <h3 className="font-extrabold">Enrolled students</h3>
        {data.students.length === 0 ? <p className="mt-3 text-sm text-slate-500">No enrolments yet.</p> : (
          <div className="table-wrap mt-4"><table className="edv"><thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Active time</th></tr></thead>
            <tbody>{data.students.map((s: any) => <tr key={s.enrollmentId}><td className="font-semibold">{s.studentName}</td><td>{s.courseTitle}</td><td><div className="flex w-44 items-center gap-2"><ProgressBar value={s.progress} className="flex-1" /><span className="text-xs font-bold">{s.progress}%</span></div></td><td>{s.activeMin} min</td></tr>)}</tbody></table></div>
        )}
      </div>

      <h2 className="mb-4 mt-10 text-xl font-extrabold">Submissions to grade ({pending.length})</h2>
      {pending.length === 0 ? <Empty title="All caught up" body="No ungraded submissions right now." /> : (
        <div className="space-y-4">
          {pending.map((s: any) => (
            <div key={s.id} className="card p-6">
              <div className="flex flex-wrap justify-between gap-2"><div><p className="font-extrabold">{s.assignmentTitle}</p><p className="text-xs text-slate-500">{s.studentName} · {s.courseTitle} · {fmtDate(s.submittedAt)}</p></div><StatusChip status={s.status} /></div>
              <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">{s.content}{s.fileName ? ` (File: ${s.fileName})` : ""}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input type="number" min={0} max={100} className="input sm:!w-32" placeholder="Grade /100" onChange={e => setGrades({ ...grades, [s.id]: { ...grades[s.id], grade: Number(e.target.value) } })} />
                <input className="input" placeholder="Feedback for the student…" onChange={e => setGrades({ ...grades, [s.id]: { ...grades[s.id], feedback: e.target.value } })} />
                <button className="btn-primary shrink-0" onClick={() => grade(s.id)}>Grade & Notify</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {graded.length > 0 && (<><h2 className="mb-4 mt-10 text-xl font-extrabold">Recently graded</h2><div className="space-y-3">{graded.map((s: any) => (
        <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span><strong>{s.studentName}</strong> · {s.assignmentTitle}</span><span className="font-bold text-emerald-600">{s.grade}/100</span></div>))}</div></>)}

      <div className="card mt-10 p-6">
        <h3 className="font-extrabold">Course announcement</h3>
        <div className="mt-4 grid gap-3">
          <select className="input" value={ann.courseId} onChange={e => setAnn({ ...ann, courseId: e.target.value })}><option value="">Select your course…</option>{data.courses.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          <input className="input" placeholder="Announcement title" value={ann.title} onChange={e => setAnn({ ...ann, title: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Message to enrolled students…" value={ann.body} onChange={e => setAnn({ ...ann, body: e.target.value })} />
          <button className="btn-dark w-fit" onClick={announce}>Send Announcement</button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle } from "@/components/ui";
export default function Announcements() {
  const { data, loading, reload } = useApi("/api/overview/admin");
  const [form, setForm] = useState({ title: "", body: "", audience: "all-students" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (loading || !data) return <Loading />;
  async function send() {
    setMsg(""); setErr("");
    try { const r = await api("/api/admin/announcements", { method: "POST", body: JSON.stringify(form) }); setMsg(`Announcement published and delivered to ${r.deliveredTo} user(s).`); setForm({ title: "", body: "", audience: "all-students" }); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <div>
      <PageTitle title="Announcements" sub="Publish platform announcements to students, tutors or everyone. Delivered in-app instantly." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. New premium courses added" /></div>
          <div><label className="label">Audience</label><select className="input" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option value="all-students">All students</option><option value="tutors">All tutors</option><option value="everyone">Everyone</option></select></div>
        </div>
        <div><label className="label">Message</label><textarea rows={4} className="input" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
        <button className="btn-primary" onClick={send}>Publish Announcement</button>
      </div>
      <h2 className="mb-4 mt-10 text-lg font-extrabold">History</h2>
      <div className="space-y-3">{data.announcements.map((a: any) => <div key={a.id} className="card p-5"><p className="font-bold">{a.title}</p><p className="text-sm text-slate-600">{a.body}</p><p className="mt-1 text-xs text-slate-400">Audience: {a.audience} · {fmtDate(a.createdAt)}</p></div>)}</div>
    </div>
  );
}

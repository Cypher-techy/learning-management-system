"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, MessageSquare } from "lucide-react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle } from "@/components/ui";

export default function Community() {
  const { data } = useApi("/api/overview/student");
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  async function load() { const d = await api("/api/discussions").catch(() => ({ discussions: [] })); setDiscussions(d.discussions || []); }
  useEffect(() => { load(); }, []);
  if (!data) return <Loading />;
  const myCourseIds = data.myCourses.map((c: any) => c.id);
  const visible = discussions.filter(d => myCourseIds.includes(d.courseId));
  async function reply(id: string) {
    if (!replyText[id]?.trim()) return;
    await api(`/api/discussions/${id}/replies`, { method: "POST", body: JSON.stringify({ body: replyText[id] }) });
    setReplyText({ ...replyText, [id]: "" }); load();
  }
  async function report(id: string) { await api("/api/reports", { method: "POST", body: JSON.stringify({ targetType: "discussion", targetId: id, reason: "Reported from community page for moderation review." }) }); setMsg("Reported to moderators. Thank you."); }
  return (
    <div>
      <PageTitle title="Learning Community" sub="Discussions from your enrolled courses. Be kind, be curious." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {visible.length === 0 ? <div className="card p-10 text-center"><MessageSquare className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-bold">No discussions in your courses yet</p><p className="mt-1 text-sm text-slate-500">Open a course classroom and start the conversation from the Community tab.</p><Link href="/dashboard/student/learning" className="btn-primary mt-5">My Learning</Link></div> : (
        <div className="space-y-4">
          {visible.map(d => (
            <div key={d.id} className="card p-6">
              <div className="flex items-start justify-between gap-3"><div><span className="chip bg-brand-500/10 text-brand-600">{(d.courseTitle || "COURSE").toUpperCase()}</span><h3 className="mt-2 font-extrabold">{d.title}</h3><p className="text-xs text-slate-400">by {d.authorName} · {fmtDate(d.createdAt)}</p></div>
                <button onClick={() => report(d.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500"><Flag size={13} /> Report</button></div>
              <p className="mt-2 text-sm text-slate-600">{d.body}</p>
              <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                {d.replies.map((r: any) => <div key={r.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">{r.authorName}</p><p className="text-sm text-slate-600">{r.body}</p></div>)}
                <div className="flex gap-2"><input className="input" placeholder="Reply…" value={replyText[d.id] || ""} onChange={e => setReplyText({ ...replyText, [d.id]: e.target.value })} /><button className="btn-dark shrink-0" onClick={() => reply(d.id)}>Reply</button></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

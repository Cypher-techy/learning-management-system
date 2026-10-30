"use client";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api, fmtDate, initials } from "@/lib/client";
import { Loading, PageTitle } from "@/components/ui";

export default function Messages({ meRole }: { meRole: string }) {
  const [data, setData] = useState<any>(null);
  const [partner, setPartner] = useState<string>("");
  const [text, setText] = useState("");
  const [me, setMe] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  void meRole;
  async function load() { setData(await api("/api/messages").catch(() => ({ messages: [], partners: [] }))); }
  useEffect(() => { load(); fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)); api("/api/messages", { method: "PATCH" }).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data, partner]);
  if (!data || !me) return <Loading />;
  const thread = data.messages.filter((m: any) => (m.fromId === me.id && m.toId === partner) || (m.toId === me.id && m.fromId === partner));
  async function send() {
    if (!partner || !text.trim()) return;
    await api("/api/messages", { method: "POST", body: JSON.stringify({ toId: partner, body: text }) });
    setText(""); load();
  }
  return (
    <div>
      <PageTitle title="Messages" sub="Private conversations. Only the two participants can read a thread." />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="card overflow-hidden lg:col-span-4">
          <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">Conversations</p>
          <div className="max-h-[480px] overflow-y-auto">
            {data.partners.map((p: any) => {
              const last = [...data.messages].reverse().find((m: any) => m.fromId === p.id || m.toId === p.id);
              return (
                <button key={p.id} onClick={() => setPartner(p.id)} className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3.5 text-left transition ${partner === p.id ? "bg-brand-500/5" : "hover:bg-slate-50"}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{initials(p.fullName)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{p.fullName}</span><span className="block truncate text-xs text-slate-400">{last ? last.body : p.title || p.role}</span></span>
                </button>
              );
            })}
            {data.partners.length === 0 && <p className="p-4 text-sm text-slate-500">No contacts available yet.</p>}
          </div>
        </div>
        <div className="card flex flex-col lg:col-span-8">
          <div className="min-h-[360px] flex-1 space-y-3 overflow-y-auto p-5">
            {!partner ? <p className="py-16 text-center text-sm text-slate-400">Select a conversation to start messaging.</p> :
              thread.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No messages yet — say hello.</p> :
              thread.map((m: any) => (
                <div key={m.id} className={`flex ${m.fromId === me.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${m.fromId === me.id ? "grad-bg text-white" : "bg-slate-100 text-slate-700"}`}>
                    <p>{m.body}</p><p className={`mt-1 text-[10px] ${m.fromId === me.id ? "text-white/70" : "text-slate-400"}`}>{fmtDate(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <input className="input" placeholder="Write a message…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} disabled={!partner} />
            <button className="btn-primary shrink-0 !px-4" onClick={send} disabled={!partner}><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: string; icon?: ReactNode }) {
  return (
    <div className="card p-5 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between"><p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>{icon && <span className="rounded-xl bg-brand-500/10 p-2 text-brand-600">{icon}</span>}</div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
export function Loading({ text = "Loading…" }: { text?: string }) {
  return <div className="flex items-center gap-3 p-10 text-slate-500"><Loader2 className="animate-spin" /> {text}</div>;
}
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="card p-10 text-center"><h3 className="font-bold">{title}</h3>{body && <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{body}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return <div className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}><div className="h-full rounded-full grad-bg transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-emerald-100 text-emerald-700", published: "bg-emerald-100 text-emerald-700", active: "bg-emerald-100 text-emerald-700", completed: "bg-emerald-100 text-emerald-700", paid: "bg-emerald-100 text-emerald-700", approved: "bg-emerald-100 text-emerald-700", graded: "bg-emerald-100 text-emerald-700", resolved: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700", in_review: "bg-amber-100 text-amber-700", submitted: "bg-amber-100 text-amber-700", open: "bg-amber-100 text-amber-700", draft: "bg-slate-200 text-slate-600",
    rejected: "bg-rose-100 text-rose-700", suspended: "bg-rose-100 text-rose-700", failed: "bg-rose-100 text-rose-700", expired: "bg-rose-100 text-rose-700", disabled: "bg-rose-100 text-rose-700", unpublished: "bg-slate-200 text-slate-600",
    free: "bg-sky-100 text-sky-700", premium: "grad-bg text-white",
  };
  return <span className={`chip ${map[status] || "bg-slate-200 text-slate-600"}`}>{status.replace(/_/g, " ").toUpperCase()}</span>;
}
export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-extrabold tracking-tight lg:text-3xl">{title}</h1>{sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}</div>{right}</div>;
}
export function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div><div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-600">{label}</span><span className="font-bold">{value.toLocaleString()}</span></div><ProgressBar value={max ? (value / max) * 100 : 0} /></div>;
}

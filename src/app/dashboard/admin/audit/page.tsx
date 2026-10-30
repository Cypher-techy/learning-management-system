"use client";
import { useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle } from "@/components/ui";
export default function Audit() {
  const { data, loading } = useApi("/api/overview/admin");
  if (loading || !data) return <Loading />;
  return (
    <div>
      <PageTitle title="Audit Logs" sub="Every sensitive action — who did it, what changed, when, and why." />
      <div className="card table-wrap"><table className="edv"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason / Detail</th></tr></thead>
        <tbody>{data.auditLogs.map((a: any) => <tr key={a.id}><td>{fmtDate(a.createdAt)}</td><td className="font-semibold">{a.actorName}</td><td><span className="chip bg-slate-100 text-slate-600">{a.action.toUpperCase()}</span></td><td className="font-mono text-xs">{a.target}</td><td className="text-slate-500">{a.reason || "—"}</td></tr>)}</tbody></table></div>
      <h2 className="mb-4 mt-10 text-lg font-extrabold">Verification decisions</h2>
      <div className="card table-wrap"><table className="edv"><thead><tr><th>When</th><th>User</th><th>Change</th><th>Decided by</th><th>Reason</th></tr></thead>
        <tbody>{data.verifications.map((v: any) => <tr key={v.id}><td>{fmtDate(v.createdAt)}</td><td className="font-semibold">{v.userName} <span className="text-xs text-slate-400">({v.role})</span></td><td>{v.from} → <strong>{v.to}</strong></td><td>{v.decidedByName}</td><td className="text-slate-500">{v.reason || "—"}</td></tr>)}</tbody></table></div>
    </div>
  );
}

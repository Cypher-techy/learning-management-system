"use client";
import { useState } from "react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip, Empty } from "@/components/ui";
export default function Reports() {
  const { data, loading, reload } = useApi("/api/overview/admin");
  const [msg, setMsg] = useState("");
  if (loading || !data) return <Loading />;
  async function act(id: string, status: string) { await api(`/api/admin/reports/${id}`, { method: "POST", body: JSON.stringify({ status }) }); setMsg(`Report ${status}.`); reload(); }
  async function revoke(c: any) {
    const reason = window.prompt(`Revoke certificate ${c.code} (${c.studentName})? Record a reason:`); if (reason === null) return;
    await api(`/api/admin/certificates/${c.id}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }); setMsg("Certificate revoked."); reload();
  }
  return (
    <div>
      <PageTitle title="Reports & Safety" sub="Community reports, support requests and certificate integrity." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {data.reports.length === 0 ? <Empty title="No reports" body="User reports and support requests will appear here." /> : (
        <div className="space-y-3">{data.reports.map((r: any) => (
          <div key={r.id} className="card flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1"><p className="text-sm font-bold">{r.targetType} · {r.targetId}</p><p className="text-sm text-slate-600">{r.reason}</p><p className="text-xs text-slate-400">Reported by {r.reporterName} · {fmtDate(r.createdAt)}</p></div>
            <StatusChip status={r.status} />
            {r.status === "open" && <div className="flex gap-2"><button className="btn-dark !py-2 !text-xs" onClick={() => act(r.id, "resolved")}>Resolve</button><button className="btn-light !py-2 !text-xs" onClick={() => act(r.id, "dismissed")}>Dismiss</button></div>}
          </div>))}</div>
      )}
      <h2 className="mb-4 mt-10 text-lg font-extrabold">Issued certificates</h2>
      <div className="card table-wrap"><table className="edv"><thead><tr><th>Reference</th><th>Student</th><th>Course</th><th>Issued</th><th>Status</th><th></th></tr></thead>
        <tbody>{data.certificates.map((c: any) => <tr key={c.id}><td className="font-mono text-xs">{c.code}</td><td className="font-semibold">{c.studentName}</td><td>{c.courseTitle}</td><td>{fmtDate(c.issuedAt)}</td><td>{c.revoked ? <StatusChip status="rejected" /> : <StatusChip status="verified" />}</td>
          <td>{!c.revoked && <button className="btn-light !px-3 !py-1.5 !text-[11px]" onClick={() => revoke(c)}>Revoke</button>}</td></tr>)}
          {data.certificates.length === 0 && <tr><td colSpan={6} className="text-slate-500">No certificates issued yet.</td></tr>}</tbody></table></div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip } from "@/components/ui";

export default function AdminUsers() {
  const { data, loading, reload } = useApi("/api/overview/admin");
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (loading || !data) return <Loading />;
  async function setStatus(id: string, status: string, name: string) {
    const reason = window.prompt(`Reason for setting ${name} to "${status}" (recorded in the audit log):`, "") ?? "";
    if (reason === null) return;
    setMsg(""); setErr("");
    try { await api(`/api/admin/users/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason }) }); setMsg(`${name} is now ${status}.`); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); }
  }
  const users = data.users.filter((u: any) => filter === "all" || u.role === filter);
  return (
    <div>
      <PageTitle title="Students & Users" sub="Review accounts, verify where manual review is needed, suspend and restore. Students auto-verify on registration." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="mb-5 flex gap-2">
        {[["all", "All Users"], ["student", "Students"], ["tutor", "Tutors"], ["administrator", "Administrators"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === k ? "grad-bg text-white" : "bg-white border border-slate-200"}`}>{l}</button>
        ))}
      </div>
      <div className="card table-wrap">
        <table className="edv"><thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{users.map((u: any) => (
            <tr key={u.id}>
              <td><p className="font-semibold">{u.fullName}</p><p className="text-xs text-slate-400">{u.email} · {u.phone}</p></td>
              <td className="capitalize">{u.role}</td><td><StatusChip status={u.plan} /></td><td>{fmtDate(u.createdAt)}</td><td><StatusChip status={u.status} /></td>
              <td><div className="flex flex-wrap gap-1.5">
                {u.role !== "administrator" ? <>
                  {u.status !== "verified" && <button className="btn-dark !px-3 !py-1.5 !text-[11px]" onClick={() => setStatus(u.id, "verified", u.fullName)}>Verify</button>}
                  {u.status === "verified" && <button className="btn-light !px-3 !py-1.5 !text-[11px]" onClick={() => setStatus(u.id, "suspended", u.fullName)}>Suspend</button>}
                  {u.status === "suspended" && <button className="btn-dark !px-3 !py-1.5 !text-[11px]" onClick={() => setStatus(u.id, "verified", u.fullName)}>Restore</button>}
                </> : <span className="text-xs text-slate-400">Owner-managed</span>}
              </div></td>
            </tr>))}</tbody></table>
      </div>
      <p className="mt-4 text-xs text-slate-400">Administrators cannot approve, appoint or modify other administrators — that authority is reserved to the platform owner.</p>
    </div>
  );
}

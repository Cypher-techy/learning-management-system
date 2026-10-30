"use client";
import { useState } from "react";
import { api, useApi, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip, Empty } from "@/components/ui";

export default function TutorVerification() {
  const { data, loading, reload } = useApi("/api/overview/admin");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (loading || !data) return <Loading />;
  const tutors = data.users.filter((u: any) => u.role === "tutor");
  const pending = tutors.filter((u: any) => u.status === "pending");
  const decided = tutors.filter((u: any) => u.status !== "pending");
  async function decide(id: string, status: string, name: string) {
    const reason = window.prompt(`${status === "verified" ? "Approve" : status === "rejected" ? "Reject" : "Update"} ${name}. Record a reason (audit log + applicant notification):`, status === "verified" ? "Credentials and profile verified." : "") ?? null;
    if (reason === null) return;
    setMsg(""); setErr("");
    try { await api(`/api/admin/users/${id}/status`, { method: "POST", body: JSON.stringify({ status, reason }) }); setMsg(`${name}: ${status}.`); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <div>
      <PageTitle title="Tutor Verification" sub="Only approved tutors can publish courses and earn revenue. Review credentials carefully — every decision is recorded." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <h2 className="mb-4 text-lg font-extrabold">Pending applications ({pending.length})</h2>
      {pending.length === 0 ? <Empty title="No pending applications" body="New tutor applications will appear here for review." /> : (
        <div className="space-y-4">
          {pending.map((u: any) => (
            <div key={u.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-lg font-extrabold">{u.fullName}</h3><p className="text-sm text-slate-500">{u.title} · {u.expertise}</p><p className="text-xs text-slate-400">{u.email} · {u.phone} · Applied {fmtDate(u.createdAt)}</p></div>
                <StatusChip status={u.status} />
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <p className="rounded-xl bg-slate-50 p-3.5"><strong>Qualifications:</strong> {u.qualifications || "—"}</p>
                <p className="rounded-xl bg-slate-50 p-3.5"><strong>Experience:</strong> {u.experience || "—"}</p>
                <p className="rounded-xl bg-slate-50 p-3.5 sm:col-span-2"><strong>Bio:</strong> {u.bio || "—"}</p>
                <p className="rounded-xl bg-slate-50 p-3.5 sm:col-span-2"><strong>Proposed courses:</strong> {u.proposedCourses || "—"}</p>
              </div>
              <p className="mt-3 text-xs text-slate-400">Credential documents are stored in a private bucket (production) and must be checked against originals before approval.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary !py-2.5" onClick={() => decide(u.id, "verified", u.fullName)}>Approve Tutor</button>
                <button className="btn-light !py-2.5" onClick={() => decide(u.id, "rejected", u.fullName)}>Reject</button>
                <button className="btn-light !py-2.5" onClick={() => decide(u.id, "pending", u.fullName)}>Request More Info</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <h2 className="mb-4 mt-10 text-lg font-extrabold">All tutors</h2>
      <div className="card table-wrap"><table className="edv"><thead><tr><th>Tutor</th><th>Expertise</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{decided.map((u: any) => <tr key={u.id}><td><p className="font-semibold">{u.fullName}</p><p className="text-xs text-slate-400">{u.title}</p></td><td>{u.expertise}</td><td><StatusChip status={u.status} /></td>
          <td>{u.status === "verified" ? <button className="btn-light !px-3 !py-1.5 !text-[11px]" onClick={() => decide(u.id, "suspended", u.fullName)}>Suspend</button> : <button className="btn-dark !px-3 !py-1.5 !text-[11px]" onClick={() => decide(u.id, "verified", u.fullName)}>Restore / Verify</button>}</td></tr>)}</tbody></table></div>
    </div>
  );
}

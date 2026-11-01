"use client";
import { useState } from "react";
import { api, useApi, kes, usd, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip, Stat } from "@/components/ui";

export default function AdminFinance() {
  const { data, loading, reload } = useApi("/api/overview/admin");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [adj, setAdj] = useState({ refunds: 0, fees: 0, taxes: 0 });
  if (loading || !data) return <Loading />;

  async function wdAction(w: any, action: string) {
    let payload: any = { action };
    if (action === "paid") { const ref = window.prompt("Enter the M-Pesa/bank transaction reference for this payout:"); if (!ref) return; payload.payoutRef = ref; }
    if (action !== "paid") payload.note = window.prompt("Note (recorded in audit log):", "") || "";
    setMsg(""); setErr("");
    try { await api(`/api/admin/withdrawals/${w.id}`, { method: "POST", body: JSON.stringify(payload) }); setMsg(`Withdrawal for ${w.tutorName}: ${action}.`); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function allocate(periodId: string) {
    if (!window.confirm("Allocate this period now? Gross is computed from completed payments in the period. This cannot be undone and revenue is never distributed twice.")) return;
    setMsg(""); setErr("");
    try {
      const r = await api("/api/admin/revenue/allocate", { method: "POST", body: JSON.stringify({ periodId, ...adj }) });
      setMsg(`Allocated ${r.period.label}: gross ${kes(r.period.gross)}, net ${kes(r.period.net)}, tutor pool ${kes(r.period.tutorPool)} across ${r.allocations.length} tutor(s).`);
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Allocation failed"); }
  }

  return (
    <div>
      <PageTitle title="Finance & Payouts" sub="Subscription revenue, M-Pesa transactions, tutor allocations and withdrawal approvals." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Collected (all time)" value={kes(data.stats.revenueKES)} />
        <Stat label="Active Subscriptions" value={data.stats.activeSubscriptions} />
        <Stat label="Failed Payments" value={data.stats.failedPayments} sub="Review & support these students" />
      </div>

      <h2 className="type-h4 mb-4 mt-10">Withdrawal queue</h2>
      <div className="card table-wrap"><table className="edv"><thead><tr><th>Tutor</th><th data-numeric>Amount</th><th>Method</th><th data-numeric>Available</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{data.withdrawals.map((w: any) => (
          <tr key={w.id}><td className="font-medium">{w.tutorName}</td><td data-numeric className="font-medium">{kes(w.amount)}</td><td>{w.method} · {w.account}</td><td data-numeric>{kes(w.available)}</td><td>{fmtDate(w.createdAt)}</td><td><StatusChip status={w.status} />{w.payoutRef && <p className="type-technical mt-1">{w.payoutRef}</p>}</td>
            <td><div className="flex gap-1.5">
              {w.status === "pending" && <><button className="btn-dark !px-3 !py-1.5 !text-xs" onClick={() => wdAction(w, "approve")}>Approve</button><button className="btn-light !px-3 !py-1.5 !text-xs" onClick={() => wdAction(w, "reject")}>Reject</button></>}
              {w.status === "approved" && <button className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => wdAction(w, "paid")}>Mark Paid</button>}
            </div></td></tr>))}
          {data.withdrawals.length === 0 && <tr><td colSpan={7} className="text-slate-500">No withdrawal requests.</td></tr>}</tbody></table></div>

      <h2 className="type-h4 mb-4 mt-10">Revenue allocation periods</h2>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-5">
        <p className="w-full text-sm text-slate-500">Net distributable = gross confirmed payments − refunds − processing fees − taxes. Tutor pool = {data.settings.tutorPercent}% of net (owner-configurable). Enter period adjustments:</p>
        {(["refunds", "fees", "taxes"] as const).map(k => <div key={k}><label className="label">{k} (KSh)</label><input type="number" className="input sm:!w-36" value={adj[k]} onChange={e => setAdj({ ...adj, [k]: Number(e.target.value) })} /></div>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {data.revenuePeriods.map((p: any) => (
          <div key={p.id} className="card p-6">
            <div className="flex items-center justify-between"><h3 className="type-h5">{p.label}</h3><span className={`chip ${p.allocated ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{p.allocated ? "ALLOCATED" : "OPEN"}</span></div>
            <p className="mt-1 type-caption text-slate-600">{p.startsAt} → {p.endsAt}</p>
            <div className="type-body-sm type-numeric mt-4 grid grid-cols-2 gap-2">
              <p>Gross: <strong>{kes(p.gross)}</strong></p><p>Net: <strong>{kes(p.net)}</strong></p>
              <p>Tutor pool: <strong>{kes(p.tutorPool)}</strong></p><p>Platform: <strong>{kes(p.platformShare)}</strong></p>
            </div>
            {!p.allocated && <button className="btn-primary mt-5" onClick={() => allocate(p.id)}>Run Allocation</button>}
          </div>
        ))}
      </div>

      <h2 className="type-h4 mb-4 mt-10">Payment transactions</h2>
      <div className="card table-wrap"><table className="edv"><thead><tr><th>Date</th><th>Student</th><th>Phone</th><th>Plan (USD display)</th><th data-numeric>Charged (KES)</th><th>FX Rate</th><th>M-Pesa Receipt</th><th>Status</th><th>Note</th></tr></thead>
        <tbody>{data.payments.map((p: any) => <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td className="font-medium">{p.studentName}</td><td className="type-numeric">{p.phone}</td><td><span className="capitalize">{p.billingInterval || "Monthly"}</span>{p.displayAmountUSD ? <span className="type-caption block text-slate-500">{usd(p.displayAmountUSD)}</span> : null}</td><td data-numeric className="font-medium">{kes(p.amount)}</td><td className="type-numeric">{p.exchangeRateUSDKES ? `${Number(p.exchangeRateUSDKES).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} / US$1` : "—"}</td><td className="type-technical">{p.mpesaReceipt || "—"}</td><td><StatusChip status={p.status} /></td><td className="type-caption max-w-[220px] truncate text-slate-600">{p.resultDesc || ""}</td></tr>)}</tbody></table></div>

      <h2 className="type-h4 mb-4 mt-10">Subscriptions</h2>
      <div className="card table-wrap"><table className="edv"><thead><tr><th>Student</th><th>Plan</th><th>Status</th><th>Started</th><th>Expires</th></tr></thead>
        <tbody>{data.subscriptions.map((s: any) => <tr key={s.id}><td className="font-semibold">{s.studentName}</td><td className="capitalize">{s.billingInterval || "Monthly"}</td><td><StatusChip status={new Date(s.expiresAt).getTime() > Date.now() && s.status === "active" ? "active" : "expired"} /></td><td>{fmtDate(s.startedAt)}</td><td>{fmtDate(s.expiresAt)}</td></tr>)}
          {data.subscriptions.length === 0 && <tr><td colSpan={5} className="text-slate-500">No subscriptions yet.</td></tr>}</tbody></table></div>
    </div>
  );
}

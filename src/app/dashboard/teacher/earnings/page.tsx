"use client";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { api, useApi, kes, fmtDate } from "@/lib/client";
import { Loading, PageTitle, Stat, StatusChip } from "@/components/ui";

export default function Earnings() {
  const { data, loading, reload } = useApi("/api/overview/teacher");
  const [amount, setAmount] = useState("");
  const [payout, setPayout] = useState<any>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  if (loading || !data) return <Loading />;
  const w = data.wallet; const u = data.user;
  const payoutForm = payout ?? { payoutMethod: u.payoutMethod || "mpesa", payoutAccount: u.payoutAccount || "" };
  async function savePayout() {
    try { await api("/api/profile", { method: "PATCH", body: JSON.stringify(payoutForm) }); setMsg("Payment details saved."); setPayout(null); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function withdraw() {
    setErr(""); setMsg("");
    try { await api("/api/teacher/withdrawals", { method: "POST", body: JSON.stringify({ amount: Number(amount), idempotencyKey: `wd-${u.id}-${Date.now()}` }) }); setMsg("Withdrawal requested. An administrator will review it; you will be notified at each step."); setAmount(""); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Withdrawal failed"); }
  }
  return (
    <div>
      <PageTitle title="Earnings Wallet" sub="Transparent monthly revenue statements. Teacher pool: 80% of net subscription revenue, allocated by premium engagement." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Earned" value={kes(w.earned)} icon={<Wallet size={19} />} />
        <Stat label="Available Balance" value={kes(w.available)} sub="Ready to withdraw" />
        <Stat label="Pending Withdrawals" value={kes(w.pending)} sub="Held during review" />
        <Stat label="Withdrawn" value={kes(w.withdrawn)} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <div className="card p-6">
            <h3 className="font-extrabold">Payment details</h3>
            <div className="mt-4 space-y-3">
              <select className="input" value={payoutForm.payoutMethod} onChange={e => setPayout({ ...payoutForm, payoutMethod: e.target.value })}><option value="mpesa">M-Pesa</option><option value="bank">Bank transfer</option></select>
              <input className="input" placeholder={payoutForm.payoutMethod === "mpesa" ? "M-Pesa number e.g. +2547…" : "Bank & account, e.g. KCB •••• 1234"} value={payoutForm.payoutAccount} onChange={e => setPayout({ ...payoutForm, payoutAccount: e.target.value })} />
              <button className="btn-dark" onClick={savePayout}>Save Payment Details</button>
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-extrabold">Request withdrawal</h3>
            <p className="mt-1 text-xs text-slate-500">Minimum: {kes(data.settings.minWithdrawalKES)}. Payouts are administrator-approved and recorded with a transaction reference.</p>
            <div className="mt-4 flex gap-3">
              <input type="number" className="input" placeholder="Amount (KSh)" value={amount} onChange={e => setAmount(e.target.value)} />
              <button className="btn-primary shrink-0" onClick={withdraw}>Withdraw</button>
            </div>
            <div className="mt-5 space-y-2">
              {data.withdrawals.map((x: any) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"><span><strong>{kes(x.amount)}</strong> via {x.method} · {fmtDate(x.createdAt)}{x.payoutRef ? ` · Ref ${x.payoutRef}` : ""}</span><StatusChip status={x.status} /></div>)}
              {data.withdrawals.length === 0 && <p className="text-sm text-slate-500">No withdrawal requests yet.</p>}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="font-extrabold">Revenue periods</h3>
            {data.revenuePeriods.map((p: any) => <div key={p.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3.5 text-sm"><span><strong>{p.label}</strong><br /><span className="text-xs text-slate-500">Net {kes(p.net)} · Teacher pool {kes(p.teacherPool)} ({p.teacherPercent}%)</span></span><span className={`chip ${p.allocated ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{p.allocated ? "ALLOCATED" : "IN PROGRESS"}</span></div>)}
          </div>
        </div>
        <div className="card p-6 lg:col-span-7">
          <h3 className="font-extrabold">Wallet statement</h3>
          <div className="table-wrap mt-4"><table className="edv"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{data.walletTxs.map((t: any) => <tr key={t.id}><td>{fmtDate(t.createdAt)}</td><td className="capitalize">{t.type}</td><td className="text-slate-500">{t.note}</td><td className={`text-right font-bold ${t.amount >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{t.amount >= 0 ? "+" : ""}{kes(t.amount)}</td></tr>)}
              {data.walletTxs.length === 0 && <tr><td colSpan={4} className="text-slate-500">Earnings appear here after the first monthly allocation.</td></tr>}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}

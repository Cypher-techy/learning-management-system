"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Crown, Smartphone } from "lucide-react";
import { api, useApi, kes, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip } from "@/components/ui";

export default function Subscription() {
  const { data, loading, reload } = useApi("/api/overview/student");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const timer = useRef<any>(null);
  useEffect(() => { if (data?.user?.phone) setPhone(data.user.phone); }, [data?.user?.phone]);
  useEffect(() => () => clearInterval(timer.current), []);
  if (loading || !data) return <Loading />;
  const u = data.user; const sub = data.subscription; const price = data.settings.premiumPriceKES;

  async function subscribe() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await api("/api/payments/mpesa/stk", { method: "POST", body: JSON.stringify({ phone }) });
      setPaymentId(r.paymentId); setMsg(r.message);
      // Poll for Daraja callback confirmation — premium only activates server-side.
      let tries = 0;
      timer.current = setInterval(async () => {
        tries++;
        const s = await api(`/api/payments/status?id=${r.paymentId}`).catch(() => null);
        if (s?.payment?.status === "completed") { clearInterval(timer.current); setMsg("Payment confirmed — Premium is now active. Hongera!"); setBusy(false); reload(); }
        else if (s?.payment?.status === "failed" || tries > 24) { clearInterval(timer.current); setBusy(false); setErr(s?.payment?.resultDesc || "We have not received confirmation yet. If you completed payment, refresh shortly or contact support with your M-Pesa receipt."); reload(); }
      }, 5000);
    } catch (e) { setErr(e instanceof Error ? e.message : "Payment could not be started"); setBusy(false); }
  }

  return (
    <div>
      <PageTitle title="Subscription" sub="Your plan, renewal and M-Pesa payment history." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{err}</p>}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-7 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-violet-600/40 blur-[80px]" />
            <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-300"><Crown size={15} /> Current Plan</p>
            <p className="relative mt-2 text-3xl font-extrabold">{u.premiumActive ? "EDVORA Premium" : "Free Plan"}</p>
            {u.premiumActive && sub ? <p className="relative mt-2 text-sm text-slate-300">Active since {fmtDate(sub.startedAt)} · Expires {fmtDate(sub.expiresAt)}. Renew before expiry to keep uninterrupted access — renewal extends from your current expiry date.</p>
              : <p className="relative mt-2 text-sm text-slate-300">You have full access to free courses. Upgrade once to unlock every premium course on EDVORA.</p>}
            <ul className="relative mt-5 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              {["All premium courses included", "Premium downloads", "Advanced analytics", "AI study assistant"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={16} className="text-brand-300" />{x}</li>)}
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="flex items-center gap-2 font-extrabold"><Smartphone className="text-emerald-500" /> {u.premiumActive ? "Renew with M-Pesa" : "Upgrade with M-Pesa"} — {kes(price)}/month</h3>
            <p className="mt-2 text-sm text-slate-500">We will send an STK Push to your phone. Enter your M-Pesa PIN to pay. Premium activates automatically once Safaricom confirms — never before.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712 345 678" aria-label="M-Pesa phone number" />
              <button className="btn-primary shrink-0" disabled={busy} onClick={subscribe}>{busy ? "Waiting for confirmation…" : `Pay ${kes(price)}`}</button>
            </div>
            {paymentId && <p className="mt-3 text-xs text-slate-400">Payment reference: {paymentId}. Keep your M-Pesa receipt message for support queries.</p>}
            <p className="mt-3 text-xs text-slate-400">No automatic recurring charges. Renewal reminders are sent in-app before expiry. Your progress is preserved if your plan lapses.</p>
          </div>
        </div>
        <aside className="lg:col-span-5">
          <div className="card p-6">
            <h3 className="font-extrabold">Payment history</h3>
            {data.payments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No payments yet.</p> : (
              <div className="table-wrap mt-4"><table className="edv !min-w-0"><thead><tr><th>Date</th><th>Amount</th><th>Receipt</th><th>Status</th></tr></thead>
                <tbody>{data.payments.map((p: any) => <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td className="font-semibold">{kes(p.amount)}</td><td className="font-mono text-xs">{p.mpesaReceipt || "—"}</td><td><StatusChip status={p.status} /></td></tr>)}</tbody></table></div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

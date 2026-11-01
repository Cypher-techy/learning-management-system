"use client";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Crown, Smartphone } from "lucide-react";
import { api, useApi, kes, usd, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip } from "@/components/ui";
import { Technical } from "@/components/Typography";

export default function Subscription() {
  const { data, loading, reload } = useApi("/api/overview/student");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "annual">("monthly");
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteErr, setQuoteErr] = useState("");
  const [quoteReload, setQuoteReload] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingFor = useRef("");

  function stopPolling() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pollingFor.current = "";
  }

  useEffect(() => { if (data?.user?.phone) setPhone(data.user.phone); }, [data?.user?.phone]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("interval");
    if (requested === "monthly" || requested === "annual") setSelectedInterval(requested);
  }, []);
  useEffect(() => {
    let alive = true;
    setQuoteLoading(true);
    setQuoteErr("");
    api(`/api/payments/quote?interval=${selectedInterval}`, { timeoutMs: 20000 })
      .then((r) => { if (alive) setQuote(r.quote); })
      .catch((e) => {
        if (!alive) return;
        setQuote(null);
        setQuoteErr(e instanceof Error ? e.message : "The live USD/KES exchange rate is temporarily unavailable.");
      })
      .finally(() => { if (alive) setQuoteLoading(false); });
    return () => { alive = false; };
  }, [selectedInterval, quoteReload]);
  useEffect(() => {
    const pending = data?.payments?.find((p: any) => p.status === "pending");
    if (pending?.id) {
      setPaymentId((current) => current || pending.id);
      if (pending.billingInterval === "monthly" || pending.billingInterval === "annual") setSelectedInterval(pending.billingInterval);
    }
  }, [data?.payments]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function checkPayment(id: string, manual = false): Promise<string> {
    if (!id) return "pending";
    if (manual) setChecking(true);
    try {
      const s = await api(`/api/payments/status?id=${encodeURIComponent(id)}`, { timeoutMs: 45000 });
      const status = String(s?.payment?.status || "pending");
      if (status === "completed") {
        stopPolling();
        setBusy(false);
        setErr("");
        setMsg("Payment confirmed — Premium is now active. Hongera!");
        reload();
      } else if (status === "failed") {
        stopPolling();
        setBusy(false);
        setMsg("");
        setErr(s.payment.resultDesc || "The M-Pesa payment did not complete. No premium access was activated.");
        reload();
      } else if (manual) {
        setErr("");
        setMsg(s.payment.resultDesc || "Safaricom has not confirmed this payment yet. Complete the prompt on your phone, then check again shortly.");
      }
      return status;
    } catch (e) {
      if (manual) setErr(e instanceof Error ? e.message : "Could not check the payment status.");
      return "pending";
    } finally {
      if (manual) setChecking(false);
    }
  }

  function schedulePoll(id: string, tries = 0) {
    stopPolling();
    pollingFor.current = id;
    timer.current = setTimeout(async () => {
      if (pollingFor.current !== id) return;
      const status = await checkPayment(id);
      if (status !== "pending" || pollingFor.current !== id) return;
      if (tries + 1 >= 24) {
        stopPolling();
        setBusy(false);
        setErr("We have not received confirmation yet. Use Check status shortly, or contact support with your M-Pesa receipt if money was deducted.");
        reload();
      } else {
        schedulePoll(id, tries + 1);
      }
    }, 5000);
  }

  async function subscribe() {
    stopPolling();
    setBusy(true); setInitiating(true); setErr(""); setMsg("");
    try {
      const r = await api("/api/payments/mpesa/stk", {
        method: "POST",
        body: JSON.stringify({ phone, interval: selectedInterval }),
        timeoutMs: 45000,
      });
      setPaymentId(r.paymentId);
      if (r.billingInterval === "monthly" || r.billingInterval === "annual") setSelectedInterval(r.billingInterval);
      setInitiating(false);
      setMsg(r.message);
      // Poll the server, which reads the callback result and can reconcile
      // through Daraja STK Query. Premium only activates server-side.
      schedulePoll(r.paymentId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment could not be started");
      setInitiating(false);
      setBusy(false);
      reload();
    }
  }

  function stopWaiting() {
    stopPolling();
    setBusy(false);
    setMsg("Automatic checking paused. Your payment reference is saved below—use Check status when you are ready.");
  }

  if (loading || !data) return <Loading />;
  const u = data.user; const sub = data.subscription;
  const plans = Array.isArray(data.subscriptionPlans) ? data.subscriptionPlans : [];
  const monthlyPlan = plans.find((plan: any) => plan.billingInterval === "monthly");
  const annualPlan = plans.find((plan: any) => plan.billingInterval === "annual");
  const annualSavingsUSD = monthlyPlan && annualPlan ? monthlyPlan.priceUSD * 12 - annualPlan.priceUSD : 0;
  const activeQuote = quote?.billingInterval === selectedInterval ? quote : null;
  const currentInterval = sub?.billingInterval === "annual" ? "Annual" : sub ? "Monthly" : null;

  return (
    <div>
      <PageTitle title="Subscription" sub="Your plan, renewal and M-Pesa payment history." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{err}</p>}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-7 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-violet-600/40 blur-[80px]" />
            <p className="type-eyebrow relative flex items-center gap-2 text-brand-300"><Crown size={15} /> Current Plan</p>
            <p className="type-h3 relative mt-2">{u.premiumActive ? `Elimu Bora Premium${currentInterval ? ` — ${currentInterval}` : ""}` : "Free Plan"}</p>
            {u.premiumActive && sub ? <p className="relative mt-2 text-sm text-slate-300">Active since {fmtDate(sub.startedAt)} · Expires {fmtDate(sub.expiresAt)}. Renew before expiry to keep uninterrupted access — a new monthly or annual term extends from your current expiry date.</p>
              : <p className="relative mt-2 text-sm text-slate-300">You have full access to free courses. Choose monthly or annual Premium to unlock every premium course on Elimu Bora.</p>}
            <ul className="relative mt-5 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              {["All premium courses included", "Premium downloads", "Advanced analytics", "AI study assistant"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={16} className="text-brand-300" />{x}</li>)}
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="type-h5 type-numeric flex items-center gap-2"><Smartphone className="text-emerald-500" /> {u.premiumActive ? "Renew with M-Pesa" : "Upgrade with M-Pesa"}</h3>
            <p className="mt-2 text-sm text-slate-500">Choose a USD Premium plan. The exact Kenyan-shilling amount is calculated from the latest exchange rate before the STK Push is sent.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Premium billing period">
              {plans.map((plan: any) => {
                const selected = plan.billingInterval === selectedInterval;
                const annual = plan.billingInterval === "annual";
                return (
                  <button
                    key={plan.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy}
                    onClick={() => setSelectedInterval(plan.billingInterval)}
                    className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand-500 bg-brand-50 shadow-soft ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-brand-300"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="type-eyebrow text-brand-700">{annual ? "Annual" : "Monthly"}</span>
                      {annual && annualSavingsUSD > 0 && <span className="chip grad-bg text-white">SAVE {usd(annualSavingsUSD)}</span>}
                    </span>
                    <span className="type-h4 type-numeric mt-2 block">{usd(plan.priceUSD)}<span className="type-body-sm font-medium text-slate-500"> / {annual ? "year" : "month"}</span></span>
                    <span className="type-caption mt-1 block text-slate-600">
                      {annual ? `${usd(plan.equivalentMonthlyUSD)}/month billed annually · ` : ""}{plan.termLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4" aria-live="polite">
              {quoteLoading ? (
                <p className="type-body-sm text-slate-600">Fetching the latest USD/KES exchange rate…</p>
              ) : activeQuote ? (
                <>
                  <p className="type-body-sm text-slate-700">
                    Displayed price: <strong>{usd(activeQuote.priceUSD)}</strong>. M-Pesa charge: <strong>{kes(activeQuote.amountKES)}</strong>.
                  </p>
                  <p className="type-caption type-numeric mt-1 text-slate-600">
                    Converted at KSh {Number(activeQuote.exchangeRateUSDKES).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} per US$1 · {activeQuote.exchangeRateSource} latest rate dated {fmtDate(activeQuote.exchangeRateDate)}.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="type-body-sm flex-1 text-rose-700">{quoteErr || "The live USD/KES exchange rate is temporarily unavailable."}</p>
                  <button type="button" className="btn-light !px-3 !py-2 !text-xs" onClick={() => setQuoteReload((value) => value + 1)}>Retry rate</button>
                </div>
              )}
            </div>

            <p className="mt-4 text-sm text-slate-500">We will send an STK Push to your phone. Enter your M-Pesa PIN to pay. Premium activates automatically once Safaricom confirms — never before.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712 345 678" aria-label="M-Pesa phone number" disabled={busy} />
              <button className="btn-primary shrink-0" disabled={busy || quoteLoading || !activeQuote} onClick={subscribe}>{initiating ? "Sending prompt…" : busy ? "Waiting for confirmation…" : activeQuote ? `Pay ${kes(activeQuote.amountKES)}` : "Fetching rate…"}</button>
              {busy && !initiating && <button className="btn-light shrink-0" onClick={stopWaiting}>Stop waiting</button>}
            </div>
            {paymentId && (
              <div className="mt-3 flex flex-wrap items-center gap-3 type-caption text-slate-600">
                <span>Payment reference: <Technical>{paymentId}</Technical>. Keep your M-Pesa receipt message for support queries.</span>
                {!busy && <button className="btn-light !px-3 !py-1.5 !text-xs" disabled={checking} onClick={() => checkPayment(paymentId, true)}>{checking ? "Checking…" : "Check status"}</button>}
              </div>
            )}
            <p className="mt-3 type-caption text-slate-600">No automatic recurring charges. Renewal reminders are sent in-app before expiry. Your progress is preserved if your plan lapses.</p>
          </div>
        </div>
        <aside className="lg:col-span-5">
          <div className="card p-6">
            <h3 className="type-h5">Payment history</h3>
            {data.payments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No payments yet.</p> : (
              <div className="table-wrap mt-4"><table className="edv !min-w-0"><thead><tr><th>Date</th><th>Plan</th><th data-numeric>Charged (KES)</th><th>Receipt</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>{data.payments.map((p: any) => <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td><span className="font-medium capitalize">{p.billingInterval || "Monthly"}</span>{p.displayAmountUSD ? <span className="type-caption block text-slate-500">{usd(p.displayAmountUSD)} displayed</span> : null}</td><td data-numeric className="font-medium">{kes(p.amount)}</td><td className="type-technical">{p.mpesaReceipt || "—"}</td><td><StatusChip status={p.status} /></td><td className="max-w-[180px] truncate type-caption text-slate-600" title={p.resultDesc || ""}>{p.resultDesc || "—"}</td></tr>)}</tbody></table></div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

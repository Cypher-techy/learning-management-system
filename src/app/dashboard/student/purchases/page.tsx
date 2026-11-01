"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, BookOpen, Crown, ReceiptText, Smartphone } from "lucide-react";
import { api, useApi, kes, usdPrice, fmtDate } from "@/lib/client";
import { Loading, PageTitle, StatusChip, ProgressBar } from "@/components/ui";
import { Technical } from "@/components/Typography";
import { CoursePrice } from "@/components/CoursePrice";

export default function Purchases() {
  const { data, loading, reload } = useApi("/api/overview/student");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
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
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("course") || params.get("courseId") || "";
    if (requested) setSelectedCourseId(requested);
  }, []);
  useEffect(() => {
    const pending = data?.payments?.find((p: any) => p.status === "pending");
    if (pending?.id) {
      setPaymentId((current) => current || pending.id);
      if (pending.courseId) setSelectedCourseId((current) => current || pending.courseId);
    }
  }, [data?.payments]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const purchases = Array.isArray(data?.coursePurchases) ? data.coursePurchases : [];
  const premiumCourses = Array.isArray(data?.premiumCourses) ? data.premiumCourses : [];
  const selectedPurchase = purchases.find((p: any) => p.courseId === selectedCourseId);
  const selectedFromOverview = premiumCourses.find((c: any) => c.id === selectedCourseId)
    || data?.myCourses?.find((c: any) => c.id === selectedCourseId)
    || selectedPurchase?.course
    || null;
  const selectedCourse = selectedDetail?.id === selectedCourseId ? selectedDetail : selectedFromOverview;
  const selectedOwned = !!selectedPurchase || !!selectedCourse?.purchased;
  const selectedUnlocked = !!selectedCourse && (
    selectedCourse.unlocked === true
    || selectedOwned
    || selectedCourse.access === "free"
    || (!!data?.user?.premiumActive && selectedCourse.access === "premium")
  );
  const selectedEnrolled = !!data?.myCourses?.some((c: any) => c.id === selectedCourseId);

  useEffect(() => {
    if (!selectedCourseId) { setSelectedDetail(null); return; }
    let alive = true;
    api(`/api/courses/${encodeURIComponent(selectedCourseId)}`)
      .then((r) => { if (alive) setSelectedDetail(r.course || null); })
      .catch(() => { if (alive) setSelectedDetail(null); });
    return () => { alive = false; };
  }, [selectedCourseId, quoteReload]);

  useEffect(() => {
    if (!selectedCourseId || !selectedCourse || selectedCourse.access !== "premium" || selectedUnlocked) {
      setQuote(null);
      setQuoteLoading(false);
      setQuoteErr("");
      return;
    }
    let alive = true;
    setQuoteLoading(true);
    setQuoteErr("");
    api(`/api/payments/quote?courseId=${encodeURIComponent(selectedCourseId)}`, { timeoutMs: 20000 })
      .then((r) => { if (alive) setQuote(r.quote); })
      .catch((e) => {
        if (!alive) return;
        setQuote(null);
        setQuoteErr(e instanceof Error ? e.message : "The live USD/KES exchange rate is temporarily unavailable.");
      })
      .finally(() => { if (alive) setQuoteLoading(false); });
    return () => { alive = false; };
  }, [selectedCourseId, selectedCourse?.access, selectedUnlocked, quoteReload]);

  function chooseCourse(courseId: string) {
    stopPolling();
    setBusy(false);
    setSelectedCourseId(courseId);
    setQuote(null);
    setMsg("");
    setErr("");
    const pending = data?.payments?.find((p: any) => p.status === "pending" && p.courseId === courseId);
    setPaymentId(pending?.id || "");
    const url = new URL(window.location.href);
    url.searchParams.set("course", courseId);
    window.history.replaceState({}, "", url);
  }

  async function checkPayment(id: string, manual = false): Promise<string> {
    if (!id) return "pending";
    if (manual) setChecking(true);
    try {
      const s = await api(`/api/payments/status?id=${encodeURIComponent(id)}`, { timeoutMs: 45000 });
      const payment = s?.payment || {};
      const status = String(payment.status || "pending");
      if (payment.courseId) setSelectedCourseId(payment.courseId);
      if (status === "completed") {
        stopPolling();
        setBusy(false);
        setErr("");
        setMsg(payment.kind === "course_purchase" || payment.courseId
          ? `Payment confirmed — lifetime access to “${payment.courseTitle || selectedCourse?.title || "your course"}” is now active.`
          : "Payment confirmed — your existing legacy Premium term is active.");
        setQuoteReload((value) => value + 1);
        reload();
      } else if (status === "failed") {
        stopPolling();
        setBusy(false);
        setMsg("");
        setErr(payment.resultDesc || "The M-Pesa payment did not complete. No course access was activated.");
        setQuoteReload((value) => value + 1);
        reload();
      } else if (manual) {
        setErr("");
        setMsg(payment.resultDesc || "Safaricom has not confirmed this payment yet. Complete the prompt on your phone, then check again shortly.");
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

  async function purchase() {
    if (!selectedCourseId) return;
    stopPolling();
    setBusy(true); setInitiating(true); setErr(""); setMsg("");
    try {
      const r = await api("/api/payments/mpesa/stk", {
        method: "POST",
        body: JSON.stringify({ phone, courseId: selectedCourseId }),
        timeoutMs: 45000,
      });
      setPaymentId(r.paymentId);
      if (r.courseId) setSelectedCourseId(r.courseId);
      setInitiating(false);
      setMsg(r.message);
      // Poll the server, which reads the callback result and can reconcile
      // through Daraja STK Query. Course access only activates server-side.
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
  const u = data.user;
  const legacySub = data.legacySubscription || data.subscription;
  const activeQuote = quote?.courseId === selectedCourseId ? quote : null;
  const paymentLabel = (p: any) => p.kind === "course_purchase" || p.courseId
    ? (p.courseTitle || "Course purchase")
    : `Legacy Premium${p.billingInterval ? ` — ${p.billingInterval}` : ""}`;

  return (
    <div>
      <PageTitle title="Purchases & Payments" sub="Buy premium courses one at a time, keep lifetime access, and review every M-Pesa payment." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{err}</p>}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-7 text-white">
            <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-violet-600/40 blur-[80px]" />
            <p className="type-eyebrow relative flex items-center gap-2 text-brand-300"><ReceiptText size={15} /> Your course access</p>
            <p className="type-h3 relative mt-2">{purchases.length} lifetime course purchase{purchases.length === 1 ? "" : "s"}</p>
            {u.premiumActive && legacySub ? (
              <p className="relative mt-2 text-sm leading-6 text-slate-300">
                You also have an existing legacy all-access Premium term until {fmtDate(legacySub.expiresAt)}. It will be honoured in full, but it is no longer sold or renewed; after it ends, premium courses you have not bought individually will lock again while your progress stays saved.
              </p>
            ) : (
              <p className="relative mt-2 text-sm leading-6 text-slate-300">Free courses remain open in your dashboard. Each premium course has its own one-off USD-displayed price — buy only the course you want and keep it for life.</p>
            )}
            <ul className="relative mt-5 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
              {["No subscription or recurring charge", "Lifetime access per purchased course", "Premium lessons and resources included", "Progress preserved on your account"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={16} className="shrink-0 text-brand-300" />{x}</li>)}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="type-h5 flex items-center gap-2"><Smartphone className="text-emerald-500" /> Buy a premium course with M-Pesa</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Select one course. Its displayed USD price uses the latest exchange rate; the server stores and charges that course’s exact Kenyan-shilling price through M-Pesa.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Premium course to buy">
              {premiumCourses.map((course: any) => {
                const selected = course.id === selectedCourseId;
                const owned = !!course.purchased;
                return (
                  <button
                    key={course.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy}
                    onClick={() => chooseCourse(course.id)}
                    className={`rounded-2xl border p-4 text-left transition ${selected ? "border-brand-500 bg-brand-50 shadow-soft ring-2 ring-brand-500/20" : "border-slate-200 bg-white hover:border-brand-300"}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="type-eyebrow text-brand-700">{course.category}</span>
                      {owned && <span className="chip bg-emerald-100 text-emerald-700">OWNED</span>}
                    </span>
                    <span className="type-card-title mt-2 block leading-snug">{course.title}</span>
                    <span className="type-caption mt-1 block text-slate-500">{course.tutorName}</span>
                    <span className="mt-3 flex items-end justify-between gap-3">
                      <CoursePrice course={course} className="font-display text-h5 font-bold" />
                      <span className="type-caption text-slate-500">one-off</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {premiumCourses.length === 0 && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No premium courses are currently published.</p>}

            {selectedCourse && (
              <div className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5" aria-live="polite">
                <div className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedCourse.image} alt="" className="hidden h-20 w-28 shrink-0 rounded-xl object-cover sm:block" />
                  <div className="min-w-0">
                    <p className="type-eyebrow text-brand-700">Selected course</p>
                    <h4 className="type-card-title mt-1">{selectedCourse.title}</h4>
                    <p className="type-caption mt-1 text-slate-500">{selectedCourse.tutorName} · {selectedCourse.totalLessons || selectedCourse.lessonCount || 0} lessons</p>
                  </div>
                </div>

                {selectedOwned ? (
                  <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-800">You already own lifetime access to this course.</p>
                    <Link href={`/courses/${selectedCourse.id}/learn`} className="btn-primary mt-3"><BookOpen size={16} /> Continue Learning</Link>
                  </div>
                ) : selectedUnlocked ? (
                  <div className="mt-4 rounded-xl bg-brand-50 p-4">
                    <p className="text-sm font-semibold text-brand-800">{selectedCourse.access === "free" ? "This is a free course, so no payment is needed." : "This course is currently included through your legacy Premium term, so no separate payment is needed right now."}</p>
                    <Link href={selectedEnrolled ? `/courses/${selectedCourse.id}/learn` : `/courses/${selectedCourse.id}`} className="btn-primary mt-3"><BookOpen size={16} /> {selectedEnrolled ? "Continue Learning" : "Open Course to Enrol"}</Link>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 rounded-xl bg-slate-50 p-4">
                      {quoteLoading ? (
                        <p className="type-body-sm text-slate-600">Fetching the latest USD/KES exchange rate…</p>
                      ) : activeQuote ? (
                        <>
                          <p className="type-body-sm text-slate-700">
                            Displayed price: <strong>{usdPrice(activeQuote.displayAmountUSD)}</strong>. Exact M-Pesa charge: <strong>{kes(activeQuote.amountKES)}</strong>.
                          </p>
                          <p className="type-caption type-numeric mt-1 leading-5 text-slate-600">
                            USD display converted at KSh {Number(activeQuote.exchangeRateUSDKES).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} per US$1 · {activeQuote.exchangeRateSource} latest rate dated {fmtDate(activeQuote.exchangeRateDate)}. The KSh transaction price is set on the course record by its tutor or the super admin before publication.
                          </p>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="type-body-sm flex-1 text-rose-700">{quoteErr || "The live USD/KES exchange rate is temporarily unavailable."}</p>
                          <button type="button" className="btn-light !px-3 !py-2 !text-xs" onClick={() => setQuoteReload((value) => value + 1)}>Retry rate</button>
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-500">We will send an STK Push to your phone. Lifetime access to this one course activates only after Safaricom confirms the exact payment — never before.</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712 345 678" aria-label="M-Pesa phone number" disabled={busy} />
                      <button className="btn-primary shrink-0" disabled={busy || quoteLoading || !activeQuote} onClick={purchase}>{initiating ? "Sending prompt…" : busy ? "Waiting for confirmation…" : activeQuote ? `Pay ${kes(activeQuote.amountKES)}` : "Fetching rate…"}</button>
                      {busy && !initiating && <button className="btn-light shrink-0" onClick={stopWaiting}>Stop waiting</button>}
                    </div>
                  </>
                )}
              </div>
            )}

            {paymentId && (
              <div className="mt-4 flex flex-wrap items-center gap-3 type-caption text-slate-600">
                <span>Payment reference: <Technical>{paymentId}</Technical>. Keep your M-Pesa receipt message for support queries.</span>
                {!busy && <button className="btn-light !px-3 !py-1.5 !text-xs" disabled={checking} onClick={() => checkPayment(paymentId, true)}>{checking ? "Checking…" : "Check status"}</button>}
              </div>
            )}
            <p className="mt-3 type-caption leading-5 text-slate-600">A failed or unconfirmed payment never unlocks a course. Your account, enrolments and learning progress are preserved.</p>
          </div>

          <div className="card p-6">
            <h3 className="type-h5 flex items-center gap-2"><Crown size={19} className="text-brand-500" /> Courses you own</h3>
            {purchases.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No individual course purchases yet. Courses you buy will appear here permanently.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {purchases.map((p: any) => (
                  <div key={p.id} className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center">
                    {p.course?.image && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.course.image} alt="" className="h-20 w-full shrink-0 rounded-xl object-cover sm:w-28" /></>}
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold leading-snug">{p.courseTitle || p.course?.title || "Purchased course"}</p>
                      <p className="type-caption mt-1 text-slate-500">Purchased {fmtDate(p.purchasedAt)} · Lifetime access{p.payment?.displayAmountUSD ? ` · Displayed ${usdPrice(p.payment.displayAmountUSD)}` : ""} · Paid {kes(p.priceKES)} via M-Pesa</p>
                      {p.course && <div className="mt-3 flex items-center gap-3"><ProgressBar value={p.course.progress || 0} className="max-w-xs flex-1" /><span className="type-caption type-numeric font-semibold">{p.course.progress || 0}%</span></div>}
                    </div>
                    <Link href={`/courses/${p.courseId}/learn`} className="btn-dark shrink-0 !py-2.5 !text-xs">Continue</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="card p-6">
            <h3 className="type-h5">Payment history</h3>
            {data.payments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No payments yet.</p> : (
              <div className="table-wrap mt-4"><table className="edv !min-w-0"><thead><tr><th>Date</th><th>Item</th><th>Displayed (USD)</th><th data-numeric>Charged (KES)</th><th>Receipt</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>{data.payments.map((p: any) => <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td><span className="font-medium capitalize">{paymentLabel(p)}</span></td><td>{p.displayAmountUSD ? usdPrice(p.displayAmountUSD) : "—"}</td><td data-numeric className="font-medium">{kes(p.amount)}</td><td className="type-technical">{p.mpesaReceipt || "—"}</td><td><StatusChip status={p.status} /></td><td className="max-w-[180px] truncate type-caption text-slate-600" title={p.resultDesc || ""}>{p.resultDesc || "—"}</td></tr>)}</tbody></table></div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

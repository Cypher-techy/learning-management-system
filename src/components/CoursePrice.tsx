"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { api, kes, kesToUsd, useUsdKesRate, usdPrice } from "@/lib/client";

export function CoursePrice({
  course,
  priceKES,
  access,
  className = "",
  showKes = false,
}: {
  course?: any;
  priceKES?: number;
  access?: string;
  className?: string;
  showKes?: boolean;
}) {
  const { rate, loading, error } = useUsdKesRate();
  const resolvedAccess = access || course?.access || "free";
  const resolvedPrice = Number(priceKES ?? course?.priceKES ?? 0);

  if (resolvedAccess === "free") return <span className={className}>{usdPrice(0)}</span>;
  if (course?.priceConfigured === false) return <span className={className}>Price not set</span>;
  if (loading) return <span className={className} aria-label="Loading USD price">US$ —</span>;
  if (error || !rate) return <span className={className}>USD price unavailable</span>;
  return (
    <span className={className}>
      {usdPrice(kesToUsd(resolvedPrice, rate))}
      {showKes && <span className="ml-2 text-[0.72em] font-medium text-slate-500">({kes(resolvedPrice)} via M-Pesa)</span>}
    </span>
  );
}

export function CoursePricingEditor({
  course,
  onSaved,
  compact = false,
}: {
  course: any;
  onSaved?: () => void;
  compact?: boolean;
}) {
  const [access, setAccess] = useState(course.access || "free");
  const [priceKES, setPriceKES] = useState(Number(course.priceKES) || 450);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setAccess(course.access || "free");
    setPriceKES(Number(course.priceKES) || 450);
  }, [course.id, course.access, course.priceKES, course.status]);

  if (course.status === "published") {
    return (
      <div className={compact ? "min-w-[190px]" : "mt-3 rounded-xl bg-slate-50 p-3"}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Lock size={13} /> Pricing locked while published</p>
        <p className="mt-1 text-xs text-slate-600">
          Learner price: <CoursePrice course={course} /> · M-Pesa charge: {course.access === "premium" ? kes(course.priceKES || 0) : kes(0)}
        </p>
      </div>
    );
  }

  async function save() {
    setBusy(true); setMsg(""); setErr("");
    try {
      await api(`/api/courses/${course.id}/pricing`, {
        method: "PATCH",
        body: JSON.stringify({ access, priceKES: access === "premium" ? Number(priceKES) : 0 }),
      });
      setMsg("Pricing saved for publication.");
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save pricing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "min-w-[260px]" : "mt-3 rounded-xl border border-brand-100 bg-brand-50/60 p-3"}>
      <p className="text-xs font-bold text-slate-800">Course pricing — tutor / super admin only</p>
      {course.access === "premium" && course.priceConfigured === false && <p className="mt-1 text-[11px] font-semibold leading-4 text-amber-700">No price saved yet. Choose KSh 350–500 and save before submitting or publishing.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select className="input !w-auto !px-3 !py-2 !text-xs" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Course access">
          <option value="free">Free</option>
          <option value="premium">Premium — paid per course</option>
        </select>
        {access === "premium" && (
          <>
            <label className="sr-only" htmlFor={`price-${course.id}`}>Course price in Kenyan shillings</label>
            <input
              id={`price-${course.id}`}
              type="number"
              min={350}
              max={500}
              step={1}
              className="input !w-28 !px-3 !py-2 !text-xs"
              value={priceKES}
              onChange={(e) => setPriceKES(Number(e.target.value))}
            />
            <span className="text-xs text-slate-600">KSh 350–500 · shown as <CoursePrice priceKES={Number(priceKES) || 0} access="premium" /></span>
          </>
        )}
        <button type="button" disabled={busy} onClick={save} className="btn-dark !px-3 !py-2 !text-xs">{busy ? "Saving…" : "Save Pricing"}</button>
      </div>
      {msg && <p className="mt-2 text-xs font-medium text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-xs font-medium text-rose-600">{err}</p>}
      <p className="mt-2 text-[11px] leading-4 text-slate-500">Set before publishing. Regular administrators can review this price but cannot change it.</p>
    </div>
  );
}

"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import StaticPage from "@/components/StaticPage";
import { api, fmtDate } from "@/lib/client";

function Inner() {
  const sp = useSearchParams();
  const [code, setCode] = useState(sp.get("code") || "");
  const [result, setResult] = useState<any>(null);
  async function check(c = code) {
    if (!c.trim()) return;
    setResult(await api(`/api/certificates/verify/${encodeURIComponent(c.trim())}`).catch(() => ({ valid: false, message: "Verification failed." })));
  }
  useEffect(() => { if (sp.get("code")) check(sp.get("code")!); }, []);
  return (
    <div>
      <div className="card flex flex-col gap-3 p-6 sm:flex-row">
        <input className="input" placeholder="Enter certificate reference, e.g. EDV-2026-XXXXXX" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && check()} />
        <button className="btn-primary shrink-0" onClick={() => check()}>Verify</button>
      </div>
      {result && (
        <div className={`mt-6 rounded-2xl p-7 ${result.valid ? "bg-emerald-50" : "bg-rose-50"}`}>
          {result.valid ? (
            <div><p className="flex items-center gap-2 text-lg font-extrabold text-emerald-700"><BadgeCheck /> Valid EDVORA Certificate</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p><strong>Learner:</strong> {result.studentName}</p><p><strong>Course:</strong> {result.courseTitle}</p>
                <p><strong>Instructor:</strong> {result.instructorName}</p><p><strong>Issued:</strong> {fmtDate(result.issuedAt)}</p>
                <p><strong>Reference:</strong> {result.code}</p>
              </div></div>
          ) : <p className="flex items-center gap-2 font-bold text-rose-600"><ShieldAlert /> {result.revoked ? "This certificate has been revoked." : result.message || "No certificate with this reference exists."}</p>}
        </div>
      )}
      <p className="mt-6 text-sm text-slate-500">Try the demo certificate reference <button className="font-bold text-brand-600 underline" onClick={() => { setCode("EDV-2026-WF8K2D"); check("EDV-2026-WF8K2D"); }}>EDV-2026-WF8K2D</button>.</p>
    </div>
  );
}
export default function Verify() {
  return <StaticPage eyebrow="Certificates" title="Verify a Certificate" intro="Confirm the authenticity of any EDVORA certificate using its unique reference code.">
    <Suspense fallback={null}><Inner /></Suspense>
  </StaticPage>;
}

"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Loading, PageTitle } from "@/components/ui";
import SettingsForm from "@/components/dash/SettingsForm";

export default function AdminSettings() {
  const { data, loading } = useApi("/api/overview/admin");
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { if (data?.settings) setS(data.settings); }, [data?.settings]);
  if (loading || !data || !s) return <Loading />;
  async function save() {
    setMsg(""); setErr("");
    try { await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ platformName: s.platformName, tagline: s.tagline, minWithdrawalKES: Number(s.minWithdrawalKES), certificateMinProgress: Number(s.certificateMinProgress), certificateMinQuiz: Number(s.certificateMinQuiz), supportEmail: s.supportEmail, supportPhone: s.supportPhone }) }); setMsg("Platform settings saved."); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  const F = ({ k, label, type = "text" }: { k: string; label: string; type?: string }) => (
    <div><label className="label">{label}</label><input type={type} step={type === "number" ? "any" : undefined} min={type === "number" ? 0 : undefined} className="input" value={s[k] ?? ""} onChange={e => setS({ ...s, [k]: e.target.value })} /></div>
  );
  return (
    <div>
      <PageTitle title="Platform Settings" sub="Operational policies regular administrators may safely adjust. Course pricing and revenue share have separate, narrower authority." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
      <div className="card mb-10 space-y-5 p-6 lg:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <F k="platformName" label="Platform name" /><F k="tagline" label="Tagline" />
          <F k="minWithdrawalKES" label="Minimum withdrawal (KSh)" type="number" />
          <F k="certificateMinProgress" label="Certificate lesson completion %" type="number" />
          <F k="certificateMinQuiz" label="Certificate quiz pass %" type="number" />
          <F k="supportEmail" label="Support email" /><F k="supportPhone" label="Support phone" />
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">There is no global Premium price. Each premium course is priced independently before publication by its tutor or the super admin within the current KSh 350–500 band; learners see the live USD equivalent and M-Pesa charges the course’s exact KSh price. Regular administrators cannot change course pricing. Tutor revenue share is currently <strong>{s.tutorPercent}%</strong>; changing it is reserved to the platform owner.</div>
        <button className="btn-primary" onClick={save}>Save Platform Settings</button>
      </div>
      <SettingsForm />
    </div>
  );
}

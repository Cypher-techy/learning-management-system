"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Loading, PageTitle } from "@/components/ui";

export default function SettingsForm() {
  const [me, setMe] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => { setMe(d.user); setForm(d.user || {}); }); }, []);
  if (!me) return <Loading />;
  async function save(e: any) {
    e.preventDefault(); setMsg(""); setErr("");
    try { await api("/api/profile", { method: "PATCH", body: JSON.stringify({ fullName: form.fullName, phone: form.phone, bio: form.bio, title: form.title, notificationPrefs: form.notificationPrefs }) }); setMsg("Profile updated."); }
    catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
  }
  async function changePw(e: any) {
    e.preventDefault(); setMsg(""); setErr("");
    try { await api("/api/profile", { method: "PATCH", body: JSON.stringify(pw) }); setMsg("Password changed successfully."); setPw({ currentPassword: "", newPassword: "" }); }
    catch (x) { setErr(x instanceof Error ? x.message : "Failed"); }
  }
  return (
    <div>
      <PageTitle title="Profile & Settings" sub="Manage your personal details, security and notifications." />
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700">{msg}</p>}
      {err && <p className="mb-4 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{err}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className="card space-y-4 p-6">
          <h3 className="font-extrabold">Personal details</h3>
          <div><label className="label">Full name</label><input className="input" value={form.fullName || ""} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input bg-slate-50" value={form.email || ""} disabled /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          {me.role === "teacher" && <>
            <div><label className="label">Professional title</label><input className="input" value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label">Bio</label><textarea className="input" rows={3} value={form.bio || ""} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
          </>}
          <div>
            <p className="label">Notifications</p>
            <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notificationPrefs?.inApp ?? true} onChange={e => setForm({ ...form, notificationPrefs: { ...form.notificationPrefs, inApp: e.target.checked } })} /> In-app notifications</label>
            <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notificationPrefs?.email ?? true} onChange={e => setForm({ ...form, notificationPrefs: { ...form.notificationPrefs, email: e.target.checked } })} /> Email notifications (when mail is configured)</label>
          </div>
          <button className="btn-dark">Save Changes</button>
        </form>
        <div className="space-y-6">
          <form onSubmit={changePw} className="card space-y-4 p-6">
            <h3 className="font-extrabold">Security</h3>
            <p className="text-xs text-slate-500">Account type: <strong>{me.role}</strong> · Status: <strong>{me.status}</strong> · Contact verified: <strong>{me.contactVerified ? "Yes" : "No"}</strong></p>
            <div><label className="label">Current password</label><input type="password" className="input" value={pw.currentPassword} onChange={e => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
            <div><label className="label">New password</label><input type="password" className="input" value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} required placeholder="Min. 8 characters" /></div>
            <button className="btn-dark">Change Password</button>
          </form>
          <div className="card p-6">
            <h3 className="font-extrabold">Two-factor authentication</h3>
            <p className="mt-2 text-sm text-slate-500">MFA for privileged accounts is enforced through the production identity provider (Supabase Auth TOTP). Configure SUPABASE_URL to enable app-based codes on this deployment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

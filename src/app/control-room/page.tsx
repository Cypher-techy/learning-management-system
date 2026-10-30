"use client";
import { useEffect, useState } from "react";
import { Crown, Landmark, ScrollText, ShieldCheck, Users, Wallet, LogOut, Settings2, GraduationCap, BookOpenCheck } from "lucide-react";
import { api, kes, fmtDate, useApi } from "@/lib/client";
import { Stat, Loading, StatusChip, PageTitle } from "@/components/ui";
import { Emblem } from "@/components/Logo";

/** Private platform control. This route is intentionally not linked from any
 *  public page, navigation or documentation. */
export default function ControlRoom() {
  const [boot, setBoot] = useState<any>(null);
  const [me, setMe] = useState<any>(undefined);
  const [form, setForm] = useState({ email: "", password: "", setupSecret: "", fullName: "" });
  const [err, setErr] = useState("");

  async function refresh() {
    const b = await fetch("/api/bootstrap/setup").then(r => r.json()).catch(() => null);
    setBoot(b);
    const d = await fetch("/api/auth/me").then(r => r.json()).catch(() => ({ user: null }));
    setMe(d.user);
  }
  useEffect(() => { refresh(); }, []);

  async function setup(e: any) {
    e.preventDefault(); setErr("");
    try { await api("/api/bootstrap/setup", { method: "POST", body: JSON.stringify(form) }); refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Setup failed"); }
  }
  async function login(e: any) {
    e.preventDefault(); setErr("");
    try { await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.email, password: form.password, expectedRole: "owner" }) }); refresh(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Sign in failed"); }
  }

  if (me === undefined || !boot) return <div className="flex min-h-screen items-center justify-center bg-navy-950"><Emblem size={56} /></div>;

  if (!me || me.role !== "owner") return (
    <div className="noise relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-950 p-5">
      <div className="pointer-events-none absolute left-1/3 top-0 h-80 w-80 rounded-full bg-brand-600/25 blur-[120px]" />
      <div className="card relative w-full max-w-md p-8">
        <div className="flex justify-center"><Emblem size={54} /></div>
        <h1 className="mt-4 text-center text-xl font-extrabold">{!boot.initialised ? "Platform Initialisation" : "Restricted Access"}</h1>
        <p className="mt-2 text-center text-sm text-slate-500">{!boot.initialised
          ? boot.configured ? "One-time secure setup. Verify the configured owner email and setup secret to create the permanent credentials."
            : "Bootstrap environment variables (OWNER_EMAIL, OWNER_SETUP_SECRET) are not configured on this deployment."
          : "Authenticate to continue."}</p>
        {err && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{err}</p>}
        {!boot.initialised ? (
          <form onSubmit={setup} className="mt-6 space-y-4">
            <div><label className="label">Full name</label><input className="input" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><label className="label">Configured email</label><input type="email" className="input" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">One-time setup secret</label><input className="input" required value={form.setupSecret} onChange={e => setForm({ ...form, setupSecret: e.target.value })} /></div>
            <div><label className="label">Permanent password (12+ characters)</label><input type="password" className="input" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <button className="btn-primary w-full" disabled={!boot.configured}>Complete Initialisation</button>
            <p className="text-center text-[11px] text-slate-400">The setup secret is invalidated permanently after successful initialisation.</p>
          </form>
        ) : (
          <form onSubmit={login} className="mt-6 space-y-4">
            <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Password</label><input type="password" className="input" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <button className="btn-primary w-full">Authenticate</button>
          </form>
        )}
      </div>
    </div>
  );

  return <OwnerConsole me={me} />;
}

function OwnerConsole({ me }: { me: any }) {
  const { data, loading, reload } = useApi("/api/overview/control");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [invite, setInvite] = useState({ fullName: "", email: "", phone: "", temporaryPassword: "" });
  const [settings, setSettings] = useState<any>(null);
  useEffect(() => { if (data?.settings) setSettings(data.settings); }, [data?.settings]);
  if (loading || !data) return <div className="p-8"><Loading text="Loading control systems…" /></div>;
  const s = data.stats;

  async function act(fn: Promise<any>, ok: string) {
    setMsg(""); setErr("");
    try { await fn; setMsg(ok); reload(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  const setStatus = (u: any, status: string) => {
    const reason = window.prompt(`Set ${u.fullName} (${u.role}) to "${status}". Reason (audited):`, "") ?? null;
    if (reason === null) return;
    act(api(`/api/admin/users/${u.id}/status`, { method: "POST", body: JSON.stringify({ status, reason }) }), `${u.fullName} → ${status}`);
  };

  const tabs = [["overview", "Overview"], ["administrators", "Administrators"], ["people", "Tutors & Students"], ["courses", "Courses"], ["finance", "Finance & Wallets"], ["config", "Configuration"], ["audit", "Security Audit"]];

  return (
    <div className="min-h-screen bg-[#070a1c] text-slate-200">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070a1c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 lg:px-8">
          <Emblem size={34} />
          <div><p className="text-sm font-extrabold tracking-widest text-white">ELIMU Bora CONTROL</p><p className="text-[10px] uppercase tracking-widest text-slate-500">Highest platform authority · {me.fullName}</p></div>
          <button className="ml-auto flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold hover:bg-white/10" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}><LogOut size={14} /> Sign Out</button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-3 lg:px-8" aria-label="Control">
          {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${tab === k ? "grad-bg text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}>{l}</button>)}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {msg && <p className="mb-4 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-300">{msg}</p>}
        {err && <p className="mb-4 rounded-xl bg-rose-500/15 p-3 text-sm text-rose-300">{err}</p>}

        {tab === "overview" && (
          <div>
            <div className="grid gap-5 text-slate-900 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Students" value={s.students} sub={`${s.verifiedStudents} verified`} icon={<Users size={19} />} />
              <Stat label="Tutors" value={s.tutors} sub={`${s.pendingTutors} pending`} icon={<GraduationCap size={19} />} />
              <Stat label="Active Subscriptions" value={s.activeSubscriptions} icon={<Crown size={19} />} />
              <Stat label="Revenue Collected" value={kes(s.revenueKES)} icon={<Landmark size={19} />} />
            </div>
            <div className="mt-6 grid gap-5 text-slate-900 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Pending Administrators" value={s.pendingAdministrators} sub="Require your approval" icon={<ShieldCheck size={19} />} />
              <Stat label="Courses in Review" value={s.coursesInReview} icon={<BookOpenCheck size={19} />} />
              <Stat label="Pending Withdrawals" value={s.pendingWithdrawals} icon={<Wallet size={19} />} />
              <Stat label="Audit Events" value={data.allAudit.length} icon={<ScrollText size={19} />} />
            </div>
            <div className="card mt-8 p-6 text-slate-900">
              <h3 className="font-extrabold">Integration status</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {Object.entries(data.integrations).map(([k, v]: any) => <div key={k} className="rounded-xl bg-slate-50 p-4 text-center"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{k.replace(/Configured$/, "").replace(/([A-Z])/g, " $1")}</p><p className={`mt-2 font-extrabold ${v ? "text-emerald-600" : "text-amber-600"}`}>{v ? "Configured" : "Not configured"}</p></div>)}
              </div>
              <p className="mt-4 text-xs text-slate-400">Configure remaining integrations through server environment variables (see .env.example). The platform runs fully on its built-in data layer until Supabase is connected.</p>
            </div>
          </div>
        )}

        {tab === "administrators" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="card p-6 text-slate-900 lg:col-span-7">
              <h3 className="font-extrabold">Administrators</h3>
              <div className="table-wrap mt-4"><table className="edv"><thead><tr><th>Administrator</th><th>Contact</th><th>Status</th><th>Authority actions</th></tr></thead>
                <tbody>{data.administrators.map((u: any) => <tr key={u.id}><td className="font-semibold">{u.fullName}</td><td className="text-xs">{u.email}<br />{u.phone}</td><td><StatusChip status={u.status} /></td>
                  <td><div className="flex flex-wrap gap-1.5">
                    {u.status !== "verified" && <button className="btn-dark !px-3 !py-1.5 !text-[11px]" onClick={() => setStatus(u, "verified")}>Approve</button>}
                    {u.status === "verified" && <button className="btn-light !px-3 !py-1.5 !text-[11px]" onClick={() => setStatus(u, "suspended")}>Suspend</button>}
                    <button className="btn-light !px-3 !py-1.5 !text-[11px]" onClick={() => setStatus(u, "disabled")}>Revoke</button>
                  </div></td></tr>)}
                  {data.administrators.length === 0 && <tr><td colSpan={4}>No administrators yet.</td></tr>}</tbody></table></div>
              <p className="mt-3 text-xs text-slate-400">Only you can create, approve, suspend or revoke administrator access. Administrators can never appoint or approve one another.</p>
            </div>
            <div className="card h-fit p-6 text-slate-900 lg:col-span-5">
              <h3 className="font-extrabold">Invite administrator</h3>
              <div className="mt-4 space-y-3">
                <input className="input" placeholder="Full name" value={invite.fullName} onChange={e => setInvite({ ...invite, fullName: e.target.value })} />
                <input className="input" placeholder="Email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} />
                <input className="input" placeholder="Phone" value={invite.phone} onChange={e => setInvite({ ...invite, phone: e.target.value })} />
                <input className="input" placeholder="Temporary password (share securely, off-platform)" value={invite.temporaryPassword} onChange={e => setInvite({ ...invite, temporaryPassword: e.target.value })} />
                <button className="btn-primary w-full" onClick={() => act(api("/api/admin/administrators", { method: "POST", body: JSON.stringify(invite) }), "Administrator invited (pending until you approve).")}>Create Pending Administrator</button>
              </div>
            </div>
          </div>
        )}

        {tab === "people" && (
          <div className="card table-wrap text-slate-900"><table className="edv"><thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Status</th><th>Override</th></tr></thead>
            <tbody>{data.users.map((u: any) => <tr key={u.id}><td><p className="font-semibold">{u.fullName}</p><p className="text-xs text-slate-400">{u.email}</p></td><td className="capitalize">{u.role}</td><td><StatusChip status={u.plan} /></td><td><StatusChip status={u.status} /></td>
              <td><div className="flex gap-1.5">{["verified", "suspended", "disabled"].filter(x => x !== u.status).map(x => <button key={x} className="btn-light !px-2.5 !py-1.5 !text-[11px] capitalize" onClick={() => setStatus(u, x)}>{x}</button>)}</div></td></tr>)}</tbody></table></div>
        )}

        {tab === "courses" && (
          <div className="card table-wrap text-slate-900"><table className="edv"><thead><tr><th>Course</th><th>Tutor</th><th>Access</th><th>Status</th><th>Enrolments</th></tr></thead>
            <tbody>{data.courses.map((c: any) => <tr key={c.id}><td className="font-semibold">{c.title}</td><td>{c.tutorName}</td><td><StatusChip status={c.access} /></td><td><StatusChip status={c.status} /></td><td>{c.enrolledCount}</td></tr>)}</tbody></table></div>
        )}

        {tab === "finance" && (
          <div className="space-y-6 text-slate-900">
            <div className="grid gap-5 sm:grid-cols-3">
              <Stat label="Revenue Collected" value={kes(s.revenueKES)} />
              <Stat label="Tutor Pool Share" value={`${data.settings.tutorPercent}%`} sub="of net distributable revenue" />
              <Stat label="Premium Price" value={kes(data.settings.premiumPriceKES)} sub="per month" />
            </div>
            <div className="card p-6"><h3 className="font-extrabold">Tutor wallet balances</h3>
              <div className="table-wrap mt-4"><table className="edv"><thead><tr><th>Tutor</th><th>Earned</th><th>Withdrawn</th><th>Balance</th><th>Available</th></tr></thead>
                <tbody>{data.tutorWallets.map((w: any) => <tr key={w.tutorId}><td className="font-semibold">{w.tutorName}</td><td>{kes(w.earned)}</td><td>{kes(w.withdrawn)}</td><td>{kes(w.balance)}</td><td className="font-bold text-emerald-600">{kes(w.available)}</td></tr>)}</tbody></table></div></div>
            <div className="card p-6"><h3 className="font-extrabold">Revenue periods</h3>
              {data.revenuePeriods.map((p: any) => <div key={p.id} className="mt-3 flex flex-wrap items-center justify-between rounded-xl bg-slate-50 p-4 text-sm"><span><strong>{p.label}</strong> · Gross {kes(p.gross)} · Net {kes(p.net)} · Pool {kes(p.tutorPool)} · Platform {kes(p.platformShare)}</span><span className={`chip ${p.allocated ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{p.allocated ? "ALLOCATED" : "OPEN"}</span></div>)}</div>
          </div>
        )}

        {tab === "config" && settings && (
          <div className="card space-y-5 p-6 text-slate-900 lg:p-8">
            <h3 className="flex items-center gap-2 font-extrabold"><Settings2 className="text-brand-500" /> Global configuration (owner authority)</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className="label">Premium price (KSh/month)</label><input type="number" className="input" value={settings.premiumPriceKES} onChange={e => setSettings({ ...settings, premiumPriceKES: Number(e.target.value) })} /></div>
              <div><label className="label">Tutor revenue share %</label><input type="number" min={0} max={100} className="input" value={settings.tutorPercent} onChange={e => setSettings({ ...settings, tutorPercent: Number(e.target.value) })} /></div>
              <div><label className="label">Minimum withdrawal (KSh)</label><input type="number" className="input" value={settings.minWithdrawalKES} onChange={e => setSettings({ ...settings, minWithdrawalKES: Number(e.target.value) })} /></div>
              <div><label className="label">Platform name</label><input className="input" value={settings.platformName} onChange={e => setSettings({ ...settings, platformName: e.target.value })} /></div>
              <div><label className="label">Tagline</label><input className="input" value={settings.tagline} onChange={e => setSettings({ ...settings, tagline: e.target.value })} /></div>
              <div><label className="label">Support email</label><input className="input" value={settings.supportEmail} onChange={e => setSettings({ ...settings, supportEmail: e.target.value })} /></div>
            </div>
            <button className="btn-primary" onClick={() => act(api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settings) }), "Global configuration saved.")}>Save Configuration</button>
            <p className="text-xs text-slate-400">Branding assets live in /public/brand. Integration credentials (Supabase, Daraja, mail, AI) are server environment variables only — never enter secrets into browser forms.</p>
          </div>
        )}

        {tab === "audit" && (
          <div className="card table-wrap text-slate-900"><table className="edv"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr></thead>
            <tbody>{data.allAudit.map((a: any) => <tr key={a.id}><td>{fmtDate(a.createdAt)}</td><td className="font-semibold">{a.actorName}</td><td><span className="chip bg-slate-100 text-slate-600">{a.action.toUpperCase()}</span></td><td className="font-mono text-xs">{a.target}</td><td className="text-slate-500">{a.reason || "—"}</td></tr>)}</tbody></table></div>
        )}
      </main>
    </div>
  );
}

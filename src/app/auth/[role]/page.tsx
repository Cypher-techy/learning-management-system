"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

const META: Record<string, { title: string; subtitle: string; demo: { email: string; password: string; label: string }[] }> = {
  student: { title: "Student", subtitle: "Learn, explore courses and develop new skills.", demo: [
    { email: "faith@example.co.ke", password: "Learn@2026", label: "Free student (Faith)" },
    { email: "david@example.co.ke", password: "Learn@2026", label: "Premium student (David)" }] },
  tutor: { title: "Tutor", subtitle: "Share knowledge, teach students and earn.", demo: [
    { email: "amina@elimubora.ac.ke", password: "Teach@2026", label: "Verified tutor (Dr Amina)" },
    { email: "kevin.omondi@example.co.ke", password: "Kevin@2026", label: "Pending applicant (Kevin)" }] },
  administrator: { title: "Administrator", subtitle: "Authorized platform management services.", demo: [
    { email: "admin@elimubora.ac.ke", password: "Admin@2026", label: "Verified admin (Grace)" }] },
};

export default function AuthPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  const meta = META[role] || META.student;
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(""); const [info, setInfo] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [form, setForm] = useState<any>({ fullName: "", email: "", phone: "", password: "", confirmPassword: "", title: "", expertise: "", qualifications: "", experience: "", bio: "", proposedCourses: "" });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) redirect(d.user); }); }, []);
  function redirect(u: any) {
    if (u.role === "owner") router.replace("/control-room");
    else router.replace(`/dashboard/${u.role === "administrator" ? "admin" : u.role}`);
  }

  async function login(e?: any, demo?: { email: string; password: string }) {
    e?.preventDefault(); setBusy(true); setErr(""); setInfo("");
    try {
      const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: demo?.email || form.email, password: demo?.password || form.password, expectedRole: role }) });
      redirect(r);
    } catch (x) { setErr(x instanceof Error ? x.message : "Sign in failed"); }
    finally { setBusy(false); }
  }
  async function register(e: any) {
    e.preventDefault(); setBusy(true); setErr(""); setInfo("");
    try {
      if (step === 1) {
        const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ ...form, role }) });
        setStep(2);
        setInfo(r.message + (r.devCode ? ` Your code is ${r.devCode}.` : ""));
        if (r.devCode) setCode(r.devCode);
      } else {
        const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email: form.email, verificationCode: code }) });
        redirect(r);
      }
    } catch (x) { setErr(x instanceof Error ? x.message : "Registration failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="noise relative hidden overflow-hidden bg-navy-950 lg:block">
        <Image src="/brand/elimu-bora-logo.png" alt="Elimu Bora" fill className="object-contain" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-300">Learn Beyond Limits.</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight">{role === "student" ? "Your classroom awaits." : role === "tutor" ? "Your students await." : "The platform awaits."}</h2>
          <p className="mt-3 max-w-md text-slate-300">{meta.subtitle}</p>
        </div>
      </div>

      <div className="relative flex flex-col bg-[#f7f8fc] px-5 py-8 lg:px-14">
        <div className="flex items-center justify-between"><Logo dark={false} /><Link href="/roles" className="text-sm font-semibold text-slate-500 hover:text-brand-600">Change account type</Link></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="mx-auto my-auto w-full max-w-md py-10">
          <span className="chip grad-bg text-white">{meta.title.toUpperCase()} ACCOUNT</span>
          <h1 className="mt-4 text-3xl font-extrabold">{mode === "login" ? "Welcome back" : role === "tutor" ? "Apply as a tutor" : role === "administrator" ? "Request administrator access" : "Create your account"}</h1>
          <p className="mt-2 text-sm text-slate-500">{mode === "login" ? meta.subtitle : role === "student" ? "Verified instantly after contact confirmation — start learning free today." : role === "tutor" ? "Applications are reviewed by our administration team before publishing is enabled." : "Administrator access is controlled and requires final approval."}</p>

          <div className="mt-7 grid grid-cols-2 rounded-full bg-slate-200/70 p-1" role="tablist">
            {(["login", "register"] as const).map(m => <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(""); setInfo(""); setStep(1); }} className={`rounded-full py-2.5 text-sm font-bold transition ${mode === m ? "bg-white shadow-soft text-navy-900" : "text-slate-500"}`}>{m === "login" ? "Sign In" : "Register"}</button>)}
          </div>

          {err && <p className="mt-5 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{err}</p>}
          {info && <p className="mt-5 rounded-xl bg-sky-50 p-3.5 text-sm font-medium text-sky-700">{info}</p>}

          {mode === "login" ? (
            <form onSubmit={login} className="mt-6 space-y-4">
              <div><label className="label" htmlFor="email">Email address</label><input id="email" type="email" required className="input" value={form.email} onChange={set("email")} placeholder="you@example.co.ke" autoComplete="email" /></div>
              <div><label className="label" htmlFor="password">Password</label>
                <div className="relative"><input id="password" type={showPw ? "text" : "password"} required className="input pr-11" value={form.password} onChange={set("password")} placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Toggle password visibility">{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
              <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Signing in…" : `Sign In as ${meta.title}`}</button>
              <p className="text-center text-xs text-slate-400">Forgot your password? Contact edvoraplatform@gmail.com for a secure reset.</p>
              <div className="rounded-2xl border border-dashed border-brand-500/40 bg-brand-500/5 p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600"><KeyRound size={13} /> Preview accounts</p>
                <div className="mt-3 flex flex-wrap gap-2">{meta.demo.map(d => <button key={d.email} type="button" disabled={busy} onClick={() => login(null, d)} className="btn-light !px-3.5 !py-2 !text-xs">{d.label}</button>)}</div>
              </div>
            </form>
          ) : step === 2 ? (
            <form onSubmit={register} className="mt-6 space-y-4">
              <div><label className="label" htmlFor="code">Verification code</label><input id="code" className="input text-center text-2xl font-bold tracking-[0.4em]" value={code} onChange={e => setCode(e.target.value)} placeholder="••••••" maxLength={6} required /></div>
              <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Verifying…" : "Verify & Create Account"}</button>
              <button type="button" className="w-full text-center text-sm text-slate-500" onClick={() => setStep(1)}>← Back to details</button>
            </form>
          ) : (
            <form onSubmit={register} className="mt-6 space-y-4">
              <div><label className="label">Full name</label><input required className="input" value={form.fullName} onChange={set("fullName")} placeholder="e.g. Wanjiku Kamau" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Email</label><input required type="email" className="input" value={form.email} onChange={set("email")} placeholder="you@example.co.ke" /></div>
                <div><label className="label">Phone (M-Pesa)</label><input required className="input" value={form.phone} onChange={set("phone")} placeholder="0712 345 678" /></div>
              </div>
              {role === "tutor" && (<>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Professional title</label><input required className="input" value={form.title} onChange={set("title")} placeholder="e.g. Tutor, Data Analyst" /></div>
                  <div><label className="label">Area of expertise</label><input required className="input" value={form.expertise} onChange={set("expertise")} placeholder="e.g. Web Development" /></div>
                </div>
                <div><label className="label">Qualifications</label><input required className="input" value={form.qualifications} onChange={set("qualifications")} placeholder="e.g. MSc Computer Science, UoN" /></div>
                <div><label className="label">Teaching / tutoring experience</label><input className="input" value={form.experience} onChange={set("experience")} placeholder="e.g. 5 years tutoring & training" /></div>
                <div><label className="label">Short professional bio</label><textarea className="input" rows={3} value={form.bio} onChange={set("bio")} placeholder="Tell students who you are and how you teach…" /></div>
                <div><label className="label">Proposed courses / subjects</label><input className="input" value={form.proposedCourses} onChange={set("proposedCourses")} placeholder="e.g. React for Beginners; Excel for Business" /></div>
                <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-500">Credential documents and a profile photograph are requested securely during review. Publishing and earnings unlock after approval.</p>
              </>)}
              {role === "administrator" && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">Administrator accounts stay pending until explicitly approved through the platform's controlled appointment process. You will be notified of the decision.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Password</label><input required type="password" className="input" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" /></div>
                <div><label className="label">Confirm password</label><input required type="password" className="input" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Repeat password" /></div>
              </div>
              <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Please wait…" : role === "tutor" ? "Submit Application" : "Register & Verify Contact"}</button>
              <p className="text-center text-xs text-slate-400">By registering you agree to Elimu Bora's <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

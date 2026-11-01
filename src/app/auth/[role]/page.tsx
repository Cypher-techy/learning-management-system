"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client";

const META: Record<string, { title: string; subtitle: string }> = {
  student: { title: "Student", subtitle: "Learn, explore courses and develop new skills." },
  tutor: { title: "Tutor", subtitle: "Share knowledge, teach students and earn." },
  administrator: { title: "Administrator", subtitle: "Sign in with your authorized account." },
};

export default function AuthPage() {
  const { role } = useParams<{ role: string }>();
  const router = useRouter();
  const meta = META[role] || META.student;
  const isAdministrator = role === "administrator";
  const canRegister = role === "student" || role === "tutor";
  const [mode, setMode] = useState<"login" | "register">("login");
  const effectiveMode = canRegister ? mode : "login";
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

  async function login(e?: any) {
    e?.preventDefault(); setBusy(true); setErr(""); setInfo("");
    try {
      const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: form.email, password: form.password, expectedRole: role }) });
      redirect(r);
    } catch (x) { setErr(x instanceof Error ? x.message : "Sign in failed"); }
    finally { setBusy(false); }
  }
  async function register(e: any) {
    e.preventDefault();
    if (!canRegister) { setMode("login"); setErr("This account type cannot be created through public registration."); return; }
    setBusy(true); setErr(""); setInfo("");
    try {
      if (step === 1) {
        const r = await api("/api/auth/register", { method: "POST", body: JSON.stringify({ ...form, role }) });
        if (r.ok) {
          // Student accounts are created and auto-verified by the first request.
          redirect(r);
          return;
        }
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
          <p className="type-eyebrow text-brand-300">Learn Beyond Limits.</p>
          <h2 className="type-h1 mt-3">{role === "student" ? "Your classroom awaits." : role === "tutor" ? "Your students await." : "The platform awaits."}</h2>
          <p className="type-lead mt-3 max-w-md text-slate-300">{meta.subtitle}</p>
        </div>
      </div>

      <div className="relative flex flex-col bg-[#f4f4f1] px-5 py-8 lg:px-14">
        <div className="flex items-center justify-between"><Logo dark={false} />{!isAdministrator && <Link href="/roles" className="font-display text-body-sm font-semibold leading-snug text-slate-600 hover:text-brand-600">Change account type</Link>}</div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="mx-auto my-auto w-full max-w-md py-10">
          <span className="chip grad-bg text-white">{isAdministrator ? "AUTHORIZED ACCESS" : `${meta.title.toUpperCase()} ACCOUNT`}</span>
          <h1 className="type-h2 mt-4">{effectiveMode === "login" ? "Welcome back" : role === "tutor" ? "Apply as a tutor" : "Create your account"}</h1>
          <p className="type-body-sm mt-2 text-slate-600">{effectiveMode === "login" ? meta.subtitle : role === "student" ? "Verified automatically when you register — no email code or approval wait." : "Applications are reviewed by our team before publishing is enabled."}</p>

          {canRegister && <div className="mt-7 grid grid-cols-2 rounded-full bg-slate-200/70 p-1" role="tablist">
            {(["login", "register"] as const).map(m => <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(""); setInfo(""); setStep(1); }} className={`rounded-full py-2.5 font-display text-body-sm font-semibold leading-tight transition ${mode === m ? "bg-white shadow-soft text-navy-900" : "text-slate-500"}`}>{m === "login" ? "Sign In" : "Register"}</button>)}
          </div>}

          {err && <p role="alert" className="type-body-sm mt-5 rounded-xl bg-rose-50 p-3.5 font-medium text-rose-700">{err}</p>}
          {info && <p role="status" className="type-body-sm mt-5 rounded-xl bg-sky-50 p-3.5 font-medium text-sky-800">{info}</p>}

          {effectiveMode === "login" ? (
            <form onSubmit={login} className="mt-6 space-y-4">
              <div><label className="label" htmlFor="email">Email address</label><input id="email" type="email" required className="input" value={form.email} onChange={set("email")} placeholder="you@example.co.ke" autoComplete="email" /></div>
              <div><label className="label" htmlFor="password">Password</label>
                <div className="relative"><input id="password" type={showPw ? "text" : "password"} required className="input pr-11" value={form.password} onChange={set("password")} placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Toggle password visibility">{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
              <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Signing in…" : isAdministrator ? "Sign In" : `Sign In as ${meta.title}`}</button>
              <p className="type-caption type-wrap-anywhere text-center text-slate-600">Forgot your password? Contact edvoraplatform@gmail.com for a secure reset.</p>
            </form>
          ) : step === 2 ? (
            <form onSubmit={register} className="mt-6 space-y-4">
              <div><label className="label" htmlFor="code">Verification code</label><input id="code" inputMode="numeric" autoComplete="one-time-code" className="input text-center font-mono text-h4 font-semibold tracking-[0.35em]" value={code} onChange={e => setCode(e.target.value)} placeholder="••••••" maxLength={6} required /></div>
              <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Verifying…" : "Verify & Create Account"}</button>
              <button type="button" className="type-body-sm w-full text-center font-medium text-slate-600" onClick={() => setStep(1)}>← Back to details</button>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">Password</label><input required type="password" className="input" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" /></div>
                <div><label className="label">Confirm password</label><input required type="password" className="input" value={form.confirmPassword} onChange={set("confirmPassword")} placeholder="Repeat password" /></div>
              </div>
              <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Please wait…" : role === "student" ? "Create Verified Student Account" : "Submit Application"}</button>
              <p className="type-caption text-center text-slate-600">By registering you agree to Elimu Bora's <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}

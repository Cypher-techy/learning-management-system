"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, X, Search } from "lucide-react";
import { Logo, Emblem } from "./Logo";
import { api, initials } from "@/lib/client";

export interface NavItem { href: string; label: string; icon: React.ReactNode }

export default function DashboardShell({ nav, roleLabel, expected, children, dataPath }: {
  nav: NavItem[]; roleLabel: string; expected: string; children: React.ReactNode; dataPath?: string;
}) {
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showN, setShowN] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  void dataPath;

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.replace("/roles"); return; }
      const role = d.user.role === "administrator" ? "admin" : d.user.role;
      if (expected !== "owner" && role !== expected && d.user.role !== "owner") { router.replace(role === "owner" ? "/control-room" : `/dashboard/${role}`); return; }
      if (expected === "owner" && d.user.role !== "owner") { router.replace("/roles"); return; }
      setUser(d.user); setChecking(false);
    }).catch(() => router.replace("/roles"));
    fetch("/api/notifications").then(r => r.json()).then(d => setNotifs(d.notifications || [])).catch(() => {});
  }, [expected, router]);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }
  async function markRead() { setShowN(!showN); if (!showN) { await api("/api/notifications", { method: "PATCH", body: "{}" }).catch(() => {}); setNotifs(notifs.map(n => ({ ...n, read: true }))); } }
  const unread = notifs.filter(n => !n.read).length;

  if (checking) return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950">
      <div className="flex flex-col items-center gap-4"><Emblem size={56} /><div className="h-1 w-40 overflow-hidden rounded-full bg-white/10"><div className="splash-bar h-full grad-bg" /></div><p className="text-xs text-slate-400">Preparing your workspace…</p></div>
    </div>
  );
  const pendingBlocked = (user.role === "teacher" || user.role === "administrator") && user.status !== "verified";

  return (
    <div className="min-h-screen bg-[#f7f8fc] lg:flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy-950 px-5 py-6 transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between"><Logo href={nav[0]?.href || "/"} /><button className="p-1 text-slate-400 lg:hidden" onClick={() => setMobile(false)}><X /></button></div>
        <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/5 p-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: user.avatarColor || "#2563eb" }}>{initials(user.fullName)}</span>
          <span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{user.fullName}</span><span className="block text-[11px] font-semibold uppercase tracking-widest text-brand-300">{roleLabel}{user.role === "student" ? (user.premiumActive ? " · Premium" : " · Free") : ""}</span></span>
        </div>
        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto" aria-label="Dashboard">
          {nav.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMobile(false)} className={`navlink ${pathname === item.href ? "navlink-active" : ""}`}>{item.icon}{item.label}</Link>
          ))}
        </nav>
        <button onClick={logout} className="navlink mt-4 w-full"><LogOut size={18} /> Sign Out</button>
      </aside>
      {mobile && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobile(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200/70 bg-white/85 px-5 backdrop-blur-xl lg:px-8">
          <button className="p-1 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu /></button>
          <Link href="/explore" className="hidden items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 transition hover:bg-slate-200 sm:flex"><Search size={15} /> Search courses…</Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button onClick={markRead} className="relative rounded-full border border-slate-200 p-2.5 transition hover:shadow-soft" aria-label="Notifications">
                <Bell size={17} />{unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full grad-bg text-[10px] font-bold text-white">{unread}</span>}
              </button>
              {showN && (
                <div className="absolute right-0 top-12 w-80 max-w-[85vw] rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
                  {notifs.length === 0 ? <p className="p-4 text-sm text-slate-500">No notifications yet.</p> : notifs.slice(0, 10).map(n => (
                    <div key={n.id} className="rounded-xl p-3 hover:bg-slate-50"><p className="text-sm font-semibold">{n.title}</p><p className="text-xs text-slate-500">{n.body}</p></div>
                  ))}
                </div>
              )}
            </div>
            <Link href="/" className="hidden text-sm font-semibold text-slate-600 hover:text-brand-600 sm:block">Visit Website</Link>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
          {pendingBlocked ? (
            <div className="card mx-auto mt-10 max-w-xl p-10 text-center">
              <span className="chip bg-amber-100 text-amber-700">APPLICATION {user.status.toUpperCase()}</span>
              <h1 className="mt-4 text-2xl font-extrabold">Your application is under review</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                {user.role === "teacher"
                  ? "Our administration team is reviewing your credentials. You will be notified as soon as a decision is made. Course creation, publishing and earnings unlock immediately after approval."
                  : "Administrator access requires final approval before it becomes active. You will be notified once your access is approved."}
              </p>
              <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-sm">
                <p><strong>Name:</strong> {user.fullName}</p><p><strong>Email:</strong> {user.email}</p>
                {user.expertise && <p><strong>Expertise:</strong> {user.expertise}</p>}
                <p><strong>Status:</strong> {user.status}</p>
              </div>
              <button onClick={logout} className="btn-light mt-6">Sign Out</button>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, LogOut } from "lucide-react";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/explore", label: "Explore Courses" }, { href: "/instructors", label: "Instructors" },
  { href: "/plans", label: "Premium" }, { href: "/how-it-works", label: "How It Works" }, { href: "/about", label: "About" },
];
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on(); window.addEventListener("scroll", on, { passive: true });
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user)).catch(() => {});
    return () => window.removeEventListener("scroll", on);
  }, []);
  const dash = user?.role === "owner" ? "/control-room" : user ? `/dashboard/${user.role === "administrator" ? "admin" : user.role}` : "/roles";
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? "bg-navy-950/85 shadow-card backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {LINKS.map(l => <Link key={l.href} href={l.href} className="text-sm font-medium text-slate-300 transition hover:text-white">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (<>
            <Link href={dash} className="btn-primary !px-5 !py-2.5"><LayoutDashboard size={16} /> My Dashboard</Link>
            <button onClick={logout} className="rounded-full border border-white/20 p-2.5 text-slate-300 transition hover:text-white" aria-label="Sign out"><LogOut size={16} /></button>
          </>) : (<>
            <Link href="/roles" className="text-sm font-semibold text-slate-200 transition hover:text-white">Sign In</Link>
            <Link href="/roles" className="btn-primary !px-5 !py-2.5">Get Started</Link>
          </>)}
        </div>
        <button className="p-2 text-white lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <nav className="border-t border-white/10 bg-navy-950/95 px-5 pb-6 pt-2 backdrop-blur-xl lg:hidden" aria-label="Mobile">
          {LINKS.map(l => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-3 text-base font-medium text-slate-200">{l.label}</Link>)}
          <Link href={user ? dash : "/roles"} onClick={() => setOpen(false)} className="btn-primary mt-3 w-full">{user ? "My Dashboard" : "Get Started"}</Link>
        </nav>
      )}
    </header>
  );
}

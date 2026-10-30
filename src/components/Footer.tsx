import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { Logo } from "./Logo";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-slate-400">
      <div className="pointer-events-none absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-brand-600/20 blur-[110px]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-2 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">Kenya's premium learning platform. Learn from verified tutors, track real progress, and earn certificates that mean something.</p>
          <div className="mt-6 space-y-2 text-sm">
            <p><a href="mailto:edvoraplatform@gmail.com" className="flex items-center gap-2 transition hover:text-white"><Mail size={15} /> edvoraplatform@gmail.com</a></p>
            <p><a href="tel:+254110966455" className="flex items-center gap-2 transition hover:text-white"><Phone size={15} /> +254 110 966 455</a></p>
            <p className="flex items-center gap-2"><MapPin size={15} /> Nairobi, Kenya</p>
          </div>
        </div>
        <div><h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">Learn</h4><ul className="space-y-2.5 text-sm">
          <li><Link href="/explore" className="hover:text-white">Explore Courses</Link></li>
          <li><Link href="/plans" className="hover:text-white">EDVORA Premium</Link></li>
          <li><Link href="/tutors" className="hover:text-white">Our Tutors</Link></li>
          <li><Link href="/verify" className="hover:text-white">Verify a Certificate</Link></li></ul></div>
        <div><h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">Company</h4><ul className="space-y-2.5 text-sm">
          <li><Link href="/about" className="hover:text-white">About EDVORA</Link></li>
          <li><Link href="/how-it-works" className="hover:text-white">How It Works</Link></li>
          <li><Link href="/faq" className="hover:text-white">FAQs</Link></li>
          <li><Link href="/contact" className="hover:text-white">Contact & Support</Link></li></ul></div>
        <div><h4 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">Legal</h4><ul className="space-y-2.5 text-sm">
          <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
          <li><Link href="/terms" className="hover:text-white">Terms & Conditions</Link></li>
          <li><Link href="/roles" className="hover:text-white">Tutor on EDVORA</Link></li></ul></div>
      </div>
      <div className="relative border-t border-white/10 py-6 text-center text-xs">© {new Date().getFullYear()} EDVORA. LEARN BEYOND LIMITS. All rights reserved.</div>
    </footer>
  );
}

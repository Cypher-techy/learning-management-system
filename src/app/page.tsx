"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, BookOpenCheck, Crown, GraduationCap, ShieldCheck, Smartphone, Sparkles, Trophy, Wallet, ChevronDown, PlayCircle, BadgeCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseCard from "@/components/CourseCard";
import { Reveal, Counter } from "@/components/Reveal";
import { Emblem } from "@/components/Logo";
import { api } from "@/lib/client";

export default function Home() {
  const [courses, setCourses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [faq, setFaq] = useState(0);

  useEffect(() => {
    api("/api/courses?sort=popular").then(d => setCourses(d.courses)).catch(() => {});
    api("/api/stats").then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      // A slim brand-gradient progress bar mirrors the reader's journey.
      gsap.fromTo("[data-scroll-progress]", { scaleX: 0 }, {
        scaleX: 1, ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3, invalidateOnRefresh: true },
      });

      // Hero lines arrive one by one, then the supporting copy settles in.
      gsap.fromTo("[data-hero-line]", { opacity: 0, y: 58, rotate: 0.6 }, {
        opacity: 1, y: 0, rotate: 0, duration: 1.05, stagger: 0.11, ease: "power3.out", delay: 0.18,
      });
      gsap.fromTo("[data-hero]", { opacity: 0, y: 42 }, {
        opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: "power3.out", delay: 0.38,
      });

      // Layered hero parallax: copy lifts away, badges drift slower, and
      // the colour orbs counter-move behind the wallpaper shade.
      gsap.to("[data-hero-copy]", {
        yPercent: -6, opacity: 0.32, ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to("[data-hero-stage]", {
        yPercent: 7, ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to("[data-orb='1']", { yPercent: 30, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true } });
      gsap.to("[data-orb='2']", { yPercent: -25, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true } });

      // The fixed wallpaper gets a very slow colour-glow drift over the
      // full page, giving light and dark sections a shared sense of motion.
      gsap.to("[data-wallpaper-glow]", {
        yPercent: -7, xPercent: 3, rotate: 1.5, ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 1.4, invalidateOnRefresh: true },
      });

      // Gradient display words shift through the brand ramp as they cross
      // the viewport instead of sitting as flat colour.
      gsap.utils.toArray<HTMLElement>("[data-gradient-scrub]").forEach((el) => {
        gsap.fromTo(el, { backgroundPosition: "0% 50%" }, {
          backgroundPosition: "100% 50%", ease: "none",
          scrollTrigger: { trigger: el, start: "top 92%", end: "bottom 28%", scrub: 1 },
        });
      });

      // Pinned horizontal course journey (desktop), with a progress rail.
      const track = trackRef.current, pin = pinRef.current;
      if (track && pin && window.innerWidth >= 1024) {
        const dist = () => Math.max(track.scrollWidth - pin.clientWidth + 80, 0);
        gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: {
            trigger: pin, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.6,
            invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: (self) => gsap.set("[data-course-progress]", { scaleX: self.progress }),
          },
        });
      }

      // Big statement lines are tied to scroll position for a cinematic,
      // reversible settle rather than a one-shot jump.
      gsap.fromTo("[data-slide-l]", { xPercent: -7, opacity: 0.25 }, {
        xPercent: 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: "[data-slide-l]", start: "top 94%", end: "top 48%", scrub: 1 },
      });
      gsap.fromTo("[data-slide-r]", { xPercent: 7, opacity: 0.25 }, {
        xPercent: 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: "[data-slide-r]", start: "top 94%", end: "top 48%", scrub: 1 },
      });
    });
    return () => ctx.revert();
  }, [courses.length]);

  const scrollToHow = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const featured = courses.filter(c => c.featured).concat(courses.filter(c => !c.featured)).slice(0, 6);
  const tutors = [...new Map(courses.map(c => [c.tutorId, c])).values()];
  const faqs = [
    { q: "Is Elimu Bora really free to start?", a: "Yes. Create a student account and it is verified automatically — no email code or waiting for approval. Free courses, quizzes, progress tracking and community access are included from day one." },
    { q: "How does Premium work?", a: "One monthly subscription unlocks every eligible premium course on the platform — you never pay per course. Pay securely with M-Pesa and your access activates automatically once Safaricom confirms payment." },
    { q: "Are certificates verifiable?", a: "Yes. Every certificate carries a unique reference code and a public verification page. Certificates are earned — you must complete the lessons and pass the assessments." },
    { q: "How do tutors earn?", a: "Verified tutors share in subscription revenue. The tutor pool (80% of net subscription revenue by default) is allocated monthly by genuine premium student engagement in their courses, and paid out via M-Pesa or bank after review." },
  ];

  return (
    <div className="landing-wallpaper relative overflow-x-clip bg-navy-950">
      <div className="landing-scroll-progress" data-scroll-progress aria-hidden="true" />
      <div className="landing-wallpaper-media" aria-hidden="true">
        <Image src="/brand/elimu-bora-logo.png" alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="landing-wallpaper-glow" data-wallpaper-glow />
      </div>
      <Navbar />
      {/* ---------------- HERO ---------------- */}
      <section ref={heroRef} className="landing-hero-shade noise relative overflow-hidden pb-20 pt-32 text-white sm:pb-24 sm:pt-36 lg:min-h-svh lg:pt-40">
        <div data-orb="1" className="pointer-events-none absolute -left-32 top-10 h-[480px] w-[480px] rounded-full bg-brand-500/25 blur-[130px]" />
        <div data-orb="2" className="pointer-events-none absolute -right-24 top-1/3 h-[520px] w-[520px] rounded-full bg-violet-600/25 blur-[140px]" />
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full opacity-50" viewBox="0 0 1440 320" preserveAspectRatio="none"><path d="M-20 240 C 240 140, 520 300, 820 210 S 1300 80, 1480 170" stroke="url(#hg)" strokeWidth="2" fill="none" /><defs><linearGradient id="hg" x1="0" x2="1"><stop stopColor="#38bdf8" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs></svg>
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 lg:grid-cols-12 lg:gap-12 lg:px-8 xl:gap-16">
          <div className="landing-hero-copy max-w-[44rem] lg:col-span-7" data-hero-copy>
            <span data-hero className="landing-kicker landing-accent-dark glass chip max-w-full !px-4 !py-2 font-bold uppercase"><Sparkles size={13} /> Kenya's Premium Learning Platform</span>
            <h1 className="landing-display landing-on-dark mt-6 font-black">
              <span className="block" data-hero-line>Discover Knowledge.</span>
              <span className="landing-gradient-text block" data-hero-line data-gradient-scrub>Develop Skills.</span>
              <span className="block" data-hero-line>Shape Your Future.</span>
            </h1>
            <p data-hero className="landing-lead landing-on-dark-copy mt-6 max-w-[38rem]">Learn from verified tutors with structured courses, real assessments and certificates employers can verify. Start free — go Premium when you are ready. <strong className="landing-on-dark whitespace-nowrap">LEARN BEYOND LIMITS.</strong></p>
            <div data-hero className="mt-8 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
              <Link href="/roles" className="btn-primary w-full !px-7 !py-3.5 !text-[0.95rem] min-[480px]:w-auto">Start Learning Free <ArrowRight size={18} /></Link>
              <Link href="/explore" className="btn-ghost w-full border-white/25 !px-7 !py-3.5 !text-[0.95rem] text-white hover:bg-white/10 min-[480px]:w-auto"><PlayCircle size={18} /> Explore Courses</Link>
            </div>
            {stats && (
              <div data-hero className="mt-10 grid max-w-[36rem] grid-cols-3 gap-4 border-t border-white/10 pt-7 sm:gap-6">
                <div><p className="landing-stat-value landing-on-dark font-extrabold"><Counter value={stats.courses} /></p><p className="landing-stat-label landing-on-dark-muted mt-1.5 uppercase">Live Courses</p></div>
                <div><p className="landing-stat-value landing-on-dark font-extrabold"><Counter value={stats.lessons} /></p><p className="landing-stat-label landing-on-dark-muted mt-1.5 uppercase">Lessons</p></div>
                <div><p className="landing-stat-value landing-on-dark font-extrabold"><Counter value={stats.tutors} /></p><p className="landing-stat-label landing-on-dark-muted mt-1.5 uppercase">Verified Tutors</p></div>
              </div>
            )}
          </div>
          <div className="pointer-events-none relative hidden min-h-[36rem] lg:col-span-5 lg:block" data-hero data-hero-stage aria-hidden="true">
            <div className="floaty landing-glass-badge absolute bottom-24 left-4 max-w-[15rem] rounded-2xl px-4 py-3.5" style={{ animationDelay: "0.6s" }}>
              <p className="landing-on-dark flex items-center gap-2 text-xs font-bold"><BadgeCheck size={15} className="text-emerald-300" /> Verified Tutors</p>
              <p className="landing-on-dark-muted mt-1 text-[11px] leading-relaxed">Every tutor is reviewed & approved</p>
            </div>
            <div className="floaty landing-glass-badge absolute right-4 top-20 max-w-[15rem] rounded-2xl px-4 py-3.5">
              <p className="landing-on-dark flex items-center gap-2 text-xs font-bold"><Smartphone size={15} className="text-brand-300" /> Pay with M-Pesa</p>
              <p className="landing-on-dark-muted mt-1 text-[11px] leading-relaxed">One subscription, every premium course</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={scrollToHow} className="landing-scroll-cue pointer-events-auto" aria-label="Scroll to how Elimu Bora works">
          <span>Scroll</span>
          <span className="landing-scroll-track"><span className="landing-scroll-dot" /></span>
        </button>
      </section>

      {/* ---------------- MARQUEE ---------------- */}
      <div className="landing-marquee-shell overflow-hidden border-b border-blue-900/10 py-5" aria-hidden="true">
        <div className="marquee landing-faint flex w-max gap-10 text-[0.78rem] font-bold uppercase tracking-[0.22em]">
          {[...(stats?.categories || ["Technology", "Data Science", "Business", "Design", "Academic"]), ...(stats?.categories || ["Technology", "Data Science", "Business", "Design", "Academic"])].map((c: string, i: number) => (
            <span key={i} className="flex items-center gap-10">{c}<Emblem size={16} /></span>
          ))}
        </div>
      </div>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how-it-works" className="landing-theme-dawn landing-section-line scroll-mt-28 py-16 sm:py-20 lg:py-24">
        <div className="relative z-[1] mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal><p className="landing-kicker landing-accent text-center font-bold uppercase">How Elimu Bora Works</p>
          <h2 className="landing-section-title landing-ink mx-auto mt-3 max-w-3xl text-center font-extrabold">From sign-up to certificate, in four honest steps</h2></Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-14 lg:grid-cols-4 lg:gap-6">
          {[
            { icon: <GraduationCap size={26} />, t: "Choose your account", d: "Student, Tutor or Administrator — pick your path. Students are verified automatically at registration." },
            { icon: <BookOpenCheck size={26} />, t: "Learn with structure", d: "Sections, video lessons, notes, assignments and quizzes. Pick up exactly where you left off, on any device." },
            { icon: <Crown size={26} />, t: "Unlock everything", d: "One M-Pesa subscription opens all premium courses. No per-course payments, no surprises." },
            { icon: <Trophy size={26} />, t: "Earn proof", d: "Complete lessons and pass assessments to earn a certificate anyone can verify online." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.08}>
              <div className="card group h-full p-6 transition hover:-translate-y-1.5 hover:shadow-card lg:p-7">
                <span className="grad-bg flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow">{s.icon}</span>
                <p className="landing-stat-label landing-muted mt-5 font-bold uppercase">Step 0{i + 1}</p>
                <h3 className="landing-ink mt-1.5 text-[1.05rem] font-bold leading-snug">{s.t}</h3><p className="landing-card-copy landing-copy mt-2 text-sm">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        </div>
      </section>

      {/* ---------------- PINNED HORIZONTAL COURSES ---------------- */}
      <section ref={pinRef} className="noise landing-theme-midnight landing-section-line relative overflow-hidden py-16 text-white sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0"><p className="landing-kicker landing-accent-dark font-bold uppercase">Featured Courses</p>
              <h2 className="landing-section-title landing-on-dark mt-3 font-extrabold">Keep scrolling.<br />Keep <span className="landing-gradient-text" data-gradient-scrub>discovering.</span></h2></div>
            <Link href="/explore" className="btn-ghost shrink-0 border-white/25 text-white hover:bg-white/10">View all courses <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className="relative mt-10 overflow-x-auto pb-4 lg:mt-12 lg:overflow-visible lg:pb-0">
          <div ref={trackRef} className="landing-course-track flex w-max gap-6 px-5 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
            {featured.map(c => <div key={c.id} className="w-[320px] shrink-0 sm:w-[360px]"><CourseCard course={c} /></div>)}
            <Link href="/explore" className="grad-ring flex w-[260px] shrink-0 flex-col items-center justify-center gap-3 rounded-2xl text-center">
              <Emblem size={52} /><span className="px-6 font-bold">Browse the full catalogue</span><ArrowRight className="text-brand-300" />
            </Link>
          </div>
        </div>
        <div className="relative mx-auto mt-8 max-w-md px-5">
          <p className="landing-kicker landing-on-dark-faint text-center font-semibold uppercase">Scroll to explore</p>
          <div className="landing-course-progress mt-3" aria-hidden="true"><span data-course-progress /></div>
        </div>
      </section>

      {/* ---------------- BIG STATEMENT ---------------- */}
      <section className="landing-theme-pearl landing-section-line overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="relative z-[1] mx-auto max-w-6xl px-5 text-center lg:px-8">
          <h2 data-slide-l className="landing-statement landing-ink font-black">Free to start.</h2>
          <h2 data-slide-r data-gradient-scrub className="landing-statement landing-gradient-text-light mt-2 font-black">Limitless to grow.</h2>
          <Reveal delay={0.15}><p className="landing-lead landing-copy mx-auto mt-6 max-w-2xl">Free students get a complete dashboard, real courses and genuine progress tracking. Premium simply removes the ceiling — every premium course, every download, advanced analytics and priority features, for one monthly price.</p></Reveal>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 text-left md:grid-cols-2 lg:mt-14">
            <Reveal><div className="card h-full p-6 sm:p-8">
              <p className="landing-stat-label landing-muted font-bold uppercase">Free</p>
              <p className="landing-price landing-ink mt-2 font-extrabold">KSh 0</p>
              <ul className="landing-copy mt-6 space-y-3 text-sm leading-6">{["All designated free courses", "Video lessons & study materials", "Quizzes, assignments & progress", "Community discussions", "Bookmarks & learning history"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="mt-0.5 shrink-0 text-emerald-500" />{x}</li>)}</ul>
              <Link href="/roles" className="btn-dark mt-8 w-full">Create Free Account</Link>
            </div></Reveal>
            <Reveal delay={0.1}><div className="landing-premium-panel relative h-full overflow-hidden rounded-2xl p-6 text-white shadow-card sm:p-8">
              <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-violet-600/40 blur-[70px]" />
              <p className="landing-stat-label landing-accent-dark relative flex items-center gap-2 font-bold uppercase"><Crown size={14} /> Premium All-Access</p>
              <p className="landing-price landing-on-dark relative mt-2 font-extrabold">One monthly price</p>
              <ul className="landing-on-dark-copy relative mt-6 space-y-3 text-sm leading-6">{["Every premium course included", "Premium downloads & resources", "Advanced learning analytics", "AI study assistant allowances", "Premium certificates & paths"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="mt-0.5 shrink-0 text-brand-300" />{x}</li>)}</ul>
              <Link href="/plans" className="btn-primary relative mt-8 w-full">See Premium <ArrowRight size={16} /></Link>
            </div></Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- TUTORS ---------------- */}
      <section className="landing-theme-ice landing-section-line py-16 sm:py-20 lg:py-24">
        <div className="relative z-[1] mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal><div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0"><p className="landing-kicker landing-accent font-bold uppercase">Meet the Tutors</p>
              <h2 className="landing-section-title landing-ink mt-3 font-extrabold">Verified experts,<br />real classrooms</h2></div>
            <Link href="/tutors" className="btn-dark shrink-0">All Tutors <ArrowRight size={16} /></Link></div></Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
            {tutors.slice(0, 3).map((c, i) => (
              <Reveal key={c.tutorId} delay={i * 0.08}>
                <Link href={`/tutors/${c.tutorId}`} className="card group block overflow-hidden transition hover:-translate-y-1.5 hover:shadow-card">
                  <div className="h-28 grad-bg relative"><div className="absolute inset-0 bg-navy-950/25" /></div>
                  <div className="relative px-6 pb-6">
                    <span className="-mt-9 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-white text-xl font-extrabold text-white shadow-soft" style={{ background: c.tutorColor }}>{c.tutorName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}</span>
                    <h3 className="landing-ink mt-4 flex items-center gap-1.5 text-[1.02rem] font-bold leading-snug group-hover:text-brand-600">{c.tutorName}<BadgeCheck size={16} className="shrink-0 text-brand-500" /></h3>
                    <p className="landing-copy mt-1 text-sm leading-6">{c.tutorTitle}</p>
                    <p className="landing-stat-label landing-muted mt-3 font-semibold uppercase">Tutoring: {c.title}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <div className="landing-aurora-panel relative mt-10 overflow-hidden rounded-3xl p-6 text-white shadow-card sm:p-8 lg:mt-12 lg:p-12">
              <div className="pointer-events-none absolute -left-10 bottom-0 h-56 w-56 rounded-full bg-brand-500/30 blur-[90px]" />
              <div className="relative grid items-center gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <h3 className="landing-subheading landing-on-dark max-w-2xl font-extrabold">Tutor on Elimu Bora. Earn from every engaged learner.</h3>
                  <p className="landing-card-copy landing-on-dark-copy mt-3 max-w-xl text-[0.95rem]">Apply once, get verified, publish courses — then share in subscription revenue with transparent monthly statements and M-Pesa payouts.</p>
                </div>
                <div className="landing-on-dark-copy flex flex-col gap-3">
                  <p className="flex items-center gap-2 text-sm leading-6"><Wallet size={17} className="landing-accent-dark shrink-0" /> 80% tutor revenue pool</p>
                  <p className="flex items-center gap-2 text-sm leading-6"><ShieldCheck size={17} className="landing-accent-dark shrink-0" /> Usage-based, fraud-resistant allocation</p>
                  <Link href="/roles" className="btn-primary mt-2">Apply as a Tutor <ArrowRight size={16} /></Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="landing-theme-dawn landing-section-line py-16 sm:py-20 lg:py-24">
        <div className="relative z-[1] mx-auto max-w-4xl px-5">
        <Reveal><h2 className="landing-section-title landing-ink text-center font-extrabold">Questions, answered</h2></Reveal>
        <div className="mt-10 space-y-3 lg:mt-12">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <div className="card overflow-hidden">
                <button onClick={() => setFaq(faq === i ? -1 : i)} className="landing-ink flex w-full items-center justify-between gap-4 p-5 text-left text-[0.98rem] font-bold leading-snug" aria-expanded={faq === i}>{f.q}<ChevronDown className={`landing-accent shrink-0 transition ${faq === i ? "rotate-180" : ""}`} /></button>
                {faq === i && <p className="landing-card-copy landing-copy px-5 pb-5 text-sm">{f.a}</p>}
              </div>
            </Reveal>
          ))}
        </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="noise landing-theme-midnight landing-section-line relative overflow-hidden py-16 text-center text-white sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[720px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[130px]" />
        <div className="relative mx-auto max-w-3xl px-5">
          <Reveal><div className="flex justify-center"><Emblem size={72} /></div>
            <h2 className="landing-section-title landing-on-dark mx-auto mt-7 max-w-2xl font-black">Your future is one <span className="landing-gradient-text" data-gradient-scrub>lesson</span> away.</h2>
            <p className="landing-lead landing-on-dark-copy mx-auto mt-5 max-w-xl">Join Elimu Bora today — free forever to start, premium when you want it all.</p>
            <Link href="/roles" className="btn-primary mt-8 !px-8 !py-3.5 !text-[0.95rem] sm:!px-9 sm:!py-4 sm:!text-base">Create Your Free Account <ArrowRight size={18} /></Link></Reveal>
        </div>
      </section>
      <Footer />
    </div>
  );
}

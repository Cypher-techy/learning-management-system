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

function ChapterEyebrow({ number, label, dark = false, center = false }: { number: string; label: string; dark?: boolean; center?: boolean }) {
  return (
    <p className={`landing-kicker landing-eyebrow ${dark ? "landing-eyebrow-dark landing-accent-dark" : "landing-accent"} ${center ? "justify-center text-center" : ""} font-bold uppercase`}>
      <span className="landing-eyebrow-number">{number}</span>
      <span className="landing-eyebrow-rule" data-line-grow aria-hidden="true" />
      <span>{label}</span>
    </p>
  );
}

export default function Home() {
  const [courses, setCourses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const courseStageRef = useRef<HTMLDivElement>(null);
  const courseViewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const courseProgressRef = useRef<HTMLSpanElement>(null);
  const courseIndexRef = useRef<HTMLSpanElement>(null);
  const [faq, setFaq] = useState(0);
  const [activeChapter, setActiveChapter] = useState("how-it-works");

  useEffect(() => {
    api("/api/courses?sort=popular").then(d => setCourses(d.courses)).catch(() => {});
    api("/api/stats").then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const ids = ["how-it-works", "featured-courses", "access", "tutors", "faq", "begin"];
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!sections.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) setActiveChapter(entry.target.id); });
    }, { rootMargin: "-38% 0px -52% 0px", threshold: 0 });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const courseViewport = courseViewportRef.current;
    let courseMM: ReturnType<typeof gsap.matchMedia> | undefined;
    const ctx = gsap.context(() => {
      // A hairline progress bar quietly mirrors the reader's journey.
      gsap.fromTo("[data-scroll-progress]", { scaleX: 0 }, {
        scaleX: 1, ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.45, invalidateOnRefresh: true },
      });

      // The opening lines are unveiled slowly, with a masked rise rather
      // than a quick bounce — an editorial entrance for the hero.
      const heroIntro = gsap.timeline({ defaults: { ease: "power4.out" } });
      heroIntro
        .fromTo("[data-hero-line]", { opacity: 0, y: 76, rotate: 1.1, clipPath: "inset(0 0 100% 0)" }, {
          opacity: 1, y: 0, rotate: 0, clipPath: "inset(0 0 0% 0)", duration: 1.35, stagger: 0.13,
          onComplete: () => gsap.set("[data-hero-line]", { clearProps: "clipPath" }),
        }, 0.2)
        .fromTo("[data-hero]", { opacity: 0, y: 34 }, {
          opacity: 1, y: 0, duration: 1.05, stagger: 0.09,
        }, "-=0.78");

      // As the reader leaves, the hero dims behind a veil while its copy,
      // badges and colour fields separate at different depths.
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1.1 },
      })
        .to("[data-hero-copy]", { yPercent: -9, scale: 0.975, opacity: 0.16 }, 0)
        .to("[data-hero-stage]", { yPercent: 9, opacity: 0.3 }, 0)
        .to("[data-hero-veil]", { opacity: 0.72 }, 0)
        .to("[data-orb='1']", { yPercent: 32 }, 0)
        .to("[data-orb='2']", { yPercent: -27 }, 0)
        .to("[data-scroll-cue]", { opacity: 0, y: 14 }, 0);

      // The fixed wallpaper receives one very slow drift over the page.
      gsap.to("[data-wallpaper-glow]", {
        yPercent: -5, xPercent: 2, rotate: 1, ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 1.8, invalidateOnRefresh: true },
      });

      // The category ribbon drifts against its own marquee as it crosses
      // the viewport, creating a second, quieter layer of motion.
      gsap.to("[data-marquee-drift]", {
        x: -46, ease: "none",
        scrollTrigger: { trigger: "[data-marquee-shell]", start: "top bottom", end: "bottom top", scrub: 1.2 },
      });

      // Hairlines draw themselves in as each chapter arrives.
      gsap.utils.toArray<HTMLElement>("[data-line-grow]").forEach((line) => {
        gsap.fromTo(line, { scaleX: 0 }, {
          scaleX: 1, ease: "none",
          scrollTrigger: { trigger: line, start: "top 94%", end: "top 58%", scrub: 1 },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-line-grow-y]").forEach((line) => {
        gsap.fromTo(line, { scaleY: 0 }, {
          scaleY: 1, ease: "none",
          scrollTrigger: { trigger: line.parentElement || line, start: "top 88%", end: "bottom 42%", scrub: 1 },
        });
      });

      // A reusable, low-amplitude parallax for glows and decorative marks.
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const speed = Number.parseFloat(el.dataset.parallax || "8");
        gsap.fromTo(el, { yPercent: speed }, {
          yPercent: -speed, ease: "none",
          scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: 1.25 },
        });
      });

      // Major panels settle upward and sharpen as they enter centre stage.
      gsap.utils.toArray<HTMLElement>("[data-panel-reveal]").forEach((panel) => {
        gsap.fromTo(panel, { y: 54, scale: 0.975, opacity: 0.38 }, {
          y: 0, scale: 1, opacity: 1, ease: "none",
          scrollTrigger: { trigger: panel, start: "top 94%", end: "top 52%", scrub: 1 },
        });
      });

      // A single sweep of light crosses dark feature panels while scrolling.
      gsap.utils.toArray<HTMLElement>("[data-sheen]").forEach((panel) => {
        gsap.fromTo(panel, { "--sheen-x": "-170%" }, {
          "--sheen-x": "430%", ease: "none",
          scrollTrigger: { trigger: panel, start: "top 88%", end: "bottom 24%", scrub: 1.25 },
        });
      });

      // Gradient words travel through the Elimu Bora colour ramp.
      gsap.utils.toArray<HTMLElement>("[data-gradient-scrub]").forEach((el) => {
        gsap.fromTo(el, { backgroundPosition: "0% 50%" }, {
          backgroundPosition: "100% 50%", ease: "none",
          scrollTrigger: { trigger: el, start: "top 94%", end: "bottom 24%", scrub: 1.1 },
        });
      });

      // Downward-scroll course gallery on every screen: ordinary vertical
      // scrolling glides the course track sideways. Desktop pins the whole
      // chapter; phones/tablets pin only the gallery stage below the navbar
      // so the cards always fit the screen. Reduced motion keeps the native
      // sideways-swipe fallback.
      const track = trackRef.current, pin = pinRef.current, stage = courseStageRef.current;
      if (track && pin && courseViewport) {
        const dist = () => Math.max(track.scrollWidth - pin.clientWidth + 80, 0);
        const createCourseGallery = (trigger: HTMLElement, start: string) => {
          if (dist() <= 0) return undefined;
          courseViewport.style.overflow = "hidden";
          const scrollDistance = () => {
            const width = window.innerWidth;
            const pace = width < 640 ? 0.82 : width < 1024 ? 0.94 : 1.08;
            return Math.max(320, Math.round(dist() * pace));
          };
          const tween = gsap.to(track, {
            x: () => -dist(), ease: "none",
            scrollTrigger: {
              trigger, start, end: () => "+=" + scrollDistance(), pin: true, scrub: 0.9,
              invalidateOnRefresh: true, anticipatePin: 1,
              onUpdate: (self) => {
                if (courseProgressRef.current) gsap.set(courseProgressRef.current, { scaleX: self.progress });
                if (courseIndexRef.current) {
                  const total = Math.max(1, Math.min(courses.length, 6));
                  const current = Math.min(total, Math.floor(self.progress * total) + 1);
                  courseIndexRef.current.textContent = String(current).padStart(2, "0");
                }
                gsap.set("[data-course-giant]", { xPercent: -12 * self.progress, opacity: 0.72 + self.progress * 0.28 });
                gsap.set(track.querySelectorAll("img"), { objectPosition: `${50 + (self.progress - 0.5) * 14}% center` });
              },
            },
          });
          return () => {
            courseViewport.style.overflow = "";
            tween.scrollTrigger?.kill();
            tween.kill();
          };
        };
        courseMM = gsap.matchMedia();
        courseMM.add("(max-width: 1023px)", () => stage ? createCourseGallery(stage, "top top+=84") : undefined);
        courseMM.add("(min-width: 1024px)", () => createCourseGallery(pin, "top top"));
      }

      // Statement lines converge slowly and sharpen under the reader's eye.
      gsap.fromTo("[data-slide-l]", { xPercent: -4, y: 26, opacity: 0.18, filter: "blur(6px)" }, {
        xPercent: 0, y: 0, opacity: 1, filter: "blur(0px)", ease: "none",
        scrollTrigger: { trigger: "[data-slide-l]", start: "top 96%", end: "top 46%", scrub: 1.1 },
      });
      gsap.fromTo("[data-slide-r]", { xPercent: 4, y: 26, opacity: 0.18, filter: "blur(6px)" }, {
        xPercent: 0, y: 0, opacity: 1, filter: "blur(0px)", ease: "none",
        scrollTrigger: { trigger: "[data-slide-r]", start: "top 96%", end: "top 46%", scrub: 1.1 },
      });

      // The access manifesto brightens clause by clause.
      gsap.utils.toArray<HTMLElement>("[data-manifesto-line]").forEach((line) => {
        gsap.fromTo(line, { opacity: 0.16 }, {
          opacity: 1, ease: "none",
          scrollTrigger: { trigger: line, start: "top 90%", end: "top 58%", scrub: 1 },
        });
      });

      // Tutor portraits drift gently against their cards for added depth.
      gsap.utils.toArray<HTMLElement>("[data-tutor-avatar]").forEach((avatar) => {
        gsap.fromTo(avatar, { yPercent: 8 }, {
          yPercent: -7, ease: "none",
          scrollTrigger: { trigger: avatar, start: "top bottom", end: "bottom top", scrub: 1.2 },
        });
      });

      // The closing emblem resolves from a soft turn as the CTA arrives.
      gsap.fromTo("[data-cta-emblem]", { scale: 0.86, rotate: -5, opacity: 0.42 }, {
        scale: 1, rotate: 0, opacity: 1, ease: "none",
        scrollTrigger: { trigger: "[data-cta-emblem]", start: "top 94%", end: "top 46%", scrub: 1 },
      });
      gsap.fromTo("[data-cta-word]", { xPercent: -2.5 }, {
        xPercent: 2.5, ease: "none",
        scrollTrigger: { trigger: "#begin", start: "top bottom", end: "bottom top", scrub: 1.2 },
      });
    });
    return () => {
      courseMM?.revert();
      ctx.revert();
      if (courseViewport) courseViewport.style.overflow = "";
    };
  }, [courses.length]);

  const scrollToSection = (id: string) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const scrollToHow = () => scrollToSection("how-it-works");

  const featured = courses.filter(c => c.featured).concat(courses.filter(c => !c.featured)).slice(0, 6);
  const tutors = [...new Map(courses.map(c => [c.tutorId, c])).values()];
  const faqs = [
    { q: "Is Elimu Bora really free to start?", a: "Yes. Create a student account and it is verified automatically — no email code or waiting for approval. Free courses, quizzes, progress tracking and community access are included from day one." },
    { q: "How does Premium work?", a: "One monthly subscription unlocks every eligible premium course on the platform — you never pay per course. Pay securely with M-Pesa and your access activates automatically once Safaricom confirms payment." },
    { q: "Are certificates verifiable?", a: "Yes. Every certificate carries a unique reference code and a public verification page. Certificates are earned — you must complete the lessons and pass the assessments." },
    { q: "How do tutors earn?", a: "Verified tutors share in subscription revenue. The tutor pool (80% of net subscription revenue by default) is allocated monthly by genuine premium student engagement in their courses, and paid out via M-Pesa or bank after review." },
  ];
  const chapters = [
    { id: "how-it-works", number: "01", label: "The Method" },
    { id: "featured-courses", number: "02", label: "Courses" },
    { id: "access", number: "03", label: "Access" },
    { id: "tutors", number: "04", label: "Tutors" },
    { id: "faq", number: "05", label: "Questions" },
    { id: "begin", number: "06", label: "Begin" },
  ];
  const handleCourseScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    const progress = max > 0 ? Math.min(1, Math.max(0, el.scrollLeft / max)) : 0;
    if (courseProgressRef.current) courseProgressRef.current.style.transform = `scaleX(${progress})`;
    if (courseIndexRef.current) {
      const total = Math.max(1, featured.length);
      const current = Math.min(total, Math.floor(progress * total) + 1);
      courseIndexRef.current.textContent = String(current).padStart(2, "0");
    }
  };

  return (
    <div className="landing-wallpaper relative overflow-x-clip bg-navy-950">
      <div className="landing-scroll-progress" data-scroll-progress aria-hidden="true" />
      <div className="landing-wallpaper-media" aria-hidden="true">
        <Image src="/brand/elimu-bora-logo.png" alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="landing-wallpaper-glow" data-wallpaper-glow />
      </div>
      <nav className="landing-chapter-rail" aria-label="Landing page chapters">
        {chapters.map(chapter => (
          <button key={chapter.id} type="button" onClick={() => scrollToSection(chapter.id)} className={`landing-chapter-link ${activeChapter === chapter.id ? "is-active" : ""}`} aria-label={`Go to chapter ${chapter.number}: ${chapter.label}`} aria-current={activeChapter === chapter.id ? "true" : undefined}>
            <span className="landing-chapter-label">{chapter.label}</span>
            <span className="landing-chapter-number">{chapter.number}</span>
            <span className="landing-chapter-line" aria-hidden="true" />
          </button>
        ))}
      </nav>
      <Navbar />
      {/* ---------------- HERO ---------------- */}
      <section ref={heroRef} className="landing-hero-shade noise relative overflow-hidden pb-24 pt-32 text-white sm:pb-28 sm:pt-36 lg:min-h-svh lg:pt-40">
        <div data-orb="1" className="pointer-events-none absolute -left-32 top-10 h-[480px] w-[480px] rounded-full bg-brand-500/20 blur-[130px]" />
        <div data-orb="2" className="pointer-events-none absolute -right-24 top-1/3 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[140px]" />
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full opacity-40" viewBox="0 0 1440 320" preserveAspectRatio="none"><path d="M-20 240 C 240 140, 520 300, 820 210 S 1300 80, 1480 170" stroke="url(#hg)" strokeWidth="2" fill="none" /><defs><linearGradient id="hg" x1="0" x2="1"><stop stopColor="#38bdf8" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs></svg>
        <div className="landing-hero-veil" data-hero-veil aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-7xl px-5 lg:px-8">
          <div className="landing-hero-copy relative z-[1] mx-auto max-w-[56rem] text-center" data-hero-copy>
            <span data-hero className="landing-kicker landing-accent-dark landing-hero-chip glass chip max-w-full !px-4 !py-2 font-bold uppercase"><Sparkles size={13} /> Kenya's Premium Learning Platform</span>
            <h1 className="landing-display landing-on-dark mt-7 font-black">
              <span className="block" data-hero-line>Discover Knowledge.</span>
              <span className="landing-gradient-text block" data-hero-line data-gradient-scrub>Develop <span className="landing-serif">Skills.</span></span>
              <span className="block" data-hero-line>Shape Your Future.</span>
            </h1>
            <p data-hero className="landing-lead landing-on-dark-copy mx-auto mt-6 max-w-[42rem]">Learn from verified tutors with structured courses, real assessments and certificates employers can verify. Start free — go Premium when you are ready. <strong className="landing-on-dark whitespace-nowrap">LEARN BEYOND LIMITS.</strong></p>
            <div data-hero className="mt-8 flex flex-col items-stretch justify-center gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center">
              <Link href="/roles" className="btn-primary w-full !px-7 !py-3.5 !text-[0.95rem] min-[480px]:w-auto">Start Learning Free <ArrowRight size={18} /></Link>
              <Link href="/explore" className="btn-ghost w-full border-white/25 !px-7 !py-3.5 !text-[0.95rem] text-white hover:bg-white/10 min-[480px]:w-auto"><PlayCircle size={18} /> Explore Courses</Link>
            </div>
            {stats && (
              <div data-hero className="mx-auto mt-10 grid max-w-[38rem] grid-cols-3 gap-4 border-t border-white/10 pt-7 text-center sm:gap-6">
                <div><p className="landing-stat-value landing-on-dark font-extrabold"><Counter value={stats.courses} /></p><p className="landing-stat-label landing-on-dark-muted mt-1.5 uppercase">Live Courses</p></div>
                <div><p className="landing-stat-value landing-on-dark font-extrabold"><Counter value={stats.lessons} /></p><p className="landing-stat-label landing-on-dark-muted mt-1.5 uppercase">Lessons</p></div>
                <div><p className="landing-stat-value landing-on-dark font-extrabold"><Counter value={stats.tutors} /></p><p className="landing-stat-label landing-on-dark-muted mt-1.5 uppercase">Verified Tutors</p></div>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 z-0 hidden xl:block" data-hero data-hero-stage aria-hidden="true">
            <div className="floaty landing-glass-badge absolute bottom-16 left-0 max-w-[15rem] rounded-2xl px-4 py-3.5" style={{ animationDelay: "0.6s" }}>
              <p className="landing-on-dark flex items-center gap-2 text-xs font-bold"><BadgeCheck size={15} className="text-emerald-300" /> Verified Tutors</p>
              <p className="landing-on-dark-muted mt-1 text-[11px] leading-relaxed">Every tutor is reviewed & approved</p>
            </div>
            <div className="floaty landing-glass-badge absolute bottom-16 right-0 max-w-[15rem] rounded-2xl px-4 py-3.5">
              <p className="landing-on-dark flex items-center gap-2 text-xs font-bold"><Smartphone size={15} className="text-brand-300" /> Pay with M-Pesa</p>
              <p className="landing-on-dark-muted mt-1 text-[11px] leading-relaxed">One subscription, every premium course</p>
            </div>
          </div>
        </div>
        <button type="button" onClick={scrollToHow} className="landing-scroll-cue pointer-events-auto" data-scroll-cue aria-label="Scroll to how Elimu Bora works">
          <span>Scroll</span>
          <span className="landing-scroll-track"><span className="landing-scroll-dot" /></span>
        </button>
      </section>

      {/* ---------------- MARQUEE ---------------- */}
      <div className="landing-marquee-shell overflow-hidden border-b border-blue-900/10 py-5" data-marquee-shell aria-hidden="true">
        <div data-marquee-drift>
          <div className="marquee landing-faint flex w-max gap-10 text-[0.78rem] font-bold uppercase tracking-[0.22em]">
            {[...(stats?.categories || ["Technology", "Data Science", "Business", "Design", "Academic"]), ...(stats?.categories || ["Technology", "Data Science", "Business", "Design", "Academic"])].map((c: string, i: number) => (
              <span key={i} className="flex items-center gap-10">{c}<Emblem size={16} /></span>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how-it-works" className="landing-theme-dawn landing-section-line scroll-mt-28 py-20 sm:py-24 lg:py-32">
        <div className="relative z-[1] mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal><div className="flex justify-center"><ChapterEyebrow number="01" label="How Elimu Bora Works" center /></div>
          <h2 className="landing-section-title landing-ink mx-auto mt-4 max-w-3xl text-center font-extrabold">From sign-up to <span className="landing-serif landing-accent">certificate</span>, in four honest steps</h2></Reveal>
        <div className="landing-journey-line hidden md:block" aria-hidden="true">
          <span data-line-grow />
          <span className="landing-journey-dot" style={{ left: "12.5%" }} />
          <span className="landing-journey-dot" style={{ left: "37.5%" }} />
          <span className="landing-journey-dot" style={{ left: "62.5%" }} />
          <span className="landing-journey-dot" style={{ left: "87.5%" }} />
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-12 lg:grid-cols-4 lg:gap-6">
          {[
            { icon: <GraduationCap size={26} />, t: "Choose your account", d: "Student, Tutor or Administrator — pick your path. Students are verified automatically at registration." },
            { icon: <BookOpenCheck size={26} />, t: "Learn with structure", d: "Sections, video lessons, notes, assignments and quizzes. Pick up exactly where you left off, on any device." },
            { icon: <Crown size={26} />, t: "Unlock everything", d: "One M-Pesa subscription opens all premium courses. No per-course payments, no surprises." },
            { icon: <Trophy size={26} />, t: "Earn proof", d: "Complete lessons and pass assessments to earn a certificate anyone can verify online." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.08}>
              <div className="card landing-step-card group h-full p-6 transition hover:-translate-y-1.5 hover:shadow-card lg:p-7">
                <span className="landing-step-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
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
      <section id="featured-courses" ref={pinRef} className="noise landing-course-section landing-theme-midnight landing-section-line relative overflow-hidden py-20 text-white sm:py-24 lg:py-32">
        <div className="landing-giant-word" data-course-giant aria-hidden="true">discover</div>
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" data-parallax="10" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid items-end gap-6 text-center lg:grid-cols-[1fr_minmax(0,44rem)_1fr]">
            <div className="min-w-0 lg:col-start-2">
              <div className="flex justify-center"><ChapterEyebrow number="02" label="Featured Courses" dark center /></div>
              <h2 className="landing-section-title landing-on-dark mx-auto mt-4 text-center font-extrabold">Keep scrolling.<br />Keep <span className="landing-gradient-text landing-serif" data-gradient-scrub>discovering.</span></h2>
              <p className="landing-card-copy landing-on-dark-muted mx-auto mt-4 max-w-xl text-center text-sm">Just scroll down — the featured collection glides sideways for you.</p>
            </div>
            <Link href="/explore" className="btn-ghost shrink-0 justify-self-center border-white/25 text-white hover:bg-white/10 lg:col-start-3 lg:justify-self-end">View all courses <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div ref={courseStageRef} className="landing-course-stage mt-12 lg:mt-14">
        <div ref={courseViewportRef} className="landing-course-viewport relative overflow-x-auto pb-4 lg:overflow-visible lg:pb-0" onScroll={handleCourseScroll}>
          <div ref={trackRef} className="landing-course-track flex w-max gap-6 px-5 pt-9 lg:px-[max(2rem,calc((100vw-80rem)/2+2rem))]">
            {featured.map((c, i) => <div key={c.id} className="relative w-[320px] shrink-0 sm:w-[360px]"><span className="landing-course-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><CourseCard course={c} /></div>)}
            <Link href="/explore" className="grad-ring flex w-[260px] shrink-0 flex-col items-center justify-center gap-3 rounded-2xl text-center">
              <Emblem size={52} /><span className="px-6 font-bold">Browse the full catalogue</span><ArrowRight className="text-brand-300" />
            </Link>
          </div>
        </div>
        <div className="landing-course-progress-wrap relative mx-auto mt-10 max-w-xl px-5">
          <div className="flex items-end justify-between gap-6">
            <p className="landing-kicker landing-on-dark-faint font-semibold uppercase">Scroll down to explore</p>
            <p className="landing-course-count" aria-hidden="true"><span ref={courseIndexRef}>01</span><i>/</i><span>{String(Math.max(featured.length, 1)).padStart(2, "0")}</span></p>
          </div>
          <div className="landing-course-progress mt-3" aria-hidden="true"><span ref={courseProgressRef} /></div>
        </div>
        </div>
      </section>

      {/* ---------------- BIG STATEMENT ---------------- */}
      <section id="access" className="landing-theme-pearl landing-section-line overflow-hidden py-20 sm:py-24 lg:py-32">
        <div className="relative z-[1] mx-auto max-w-6xl px-5 text-center lg:px-8">
          <div className="mb-7 flex justify-center"><ChapterEyebrow number="03" label="Access, Beautifully Simple" center /></div>
          <h2 data-slide-l className="landing-statement landing-ink font-black">Free to start.</h2>
          <h2 data-slide-r data-gradient-scrub className="landing-statement landing-gradient-text-light mt-2 font-black">Limitless to <span className="landing-serif">grow.</span></h2>
          <Reveal delay={0.15}><p className="landing-lead landing-copy mx-auto mt-7 max-w-2xl"><span data-manifesto-line>Free students get a complete dashboard, real courses and genuine progress tracking.</span> <span data-manifesto-line>Premium simply removes the ceiling — every premium course, every download, advanced analytics and priority features,</span> <span data-manifesto-line>for one monthly price.</span></p></Reveal>
          <div className="relative mx-auto mt-12 grid max-w-4xl gap-6 text-left md:grid-cols-2 lg:mt-16">
            <div className="landing-pricing-line" aria-hidden="true"><span data-line-grow-y /></div>
            <Reveal><div className="card h-full p-6 sm:p-8" data-panel-reveal>
              <p className="landing-stat-label landing-muted font-bold uppercase">Free</p>
              <p className="landing-price landing-ink mt-2 font-extrabold">KSh 0</p>
              <ul className="landing-copy mt-6 space-y-3 text-sm leading-6">{["All designated free courses", "Video lessons & study materials", "Quizzes, assignments & progress", "Community discussions", "Bookmarks & learning history"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="mt-0.5 shrink-0 text-emerald-500" />{x}</li>)}</ul>
              <Link href="/roles" className="btn-dark mt-8 w-full">Create Free Account</Link>
            </div></Reveal>
            <Reveal delay={0.1}><div className="landing-premium-panel landing-sheen relative h-full overflow-hidden rounded-2xl p-6 text-white shadow-card sm:p-8" data-panel-reveal data-sheen>
              <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-violet-600/40 blur-[70px]" data-parallax="8" />
              <p className="landing-stat-label landing-accent-dark relative flex items-center gap-2 font-bold uppercase"><Crown size={14} /> Premium All-Access</p>
              <p className="landing-price landing-on-dark relative mt-2 font-extrabold">One monthly price</p>
              <ul className="landing-on-dark-copy relative mt-6 space-y-3 text-sm leading-6">{["Every premium course included", "Premium downloads & resources", "Advanced learning analytics", "AI study assistant allowances", "Premium certificates & paths"].map(x => <li key={x} className="flex gap-2"><BadgeCheck size={17} className="mt-0.5 shrink-0 text-brand-300" />{x}</li>)}</ul>
              <Link href="/plans" className="btn-primary relative mt-8 w-full">See Premium <ArrowRight size={16} /></Link>
            </div></Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- TUTORS ---------------- */}
      <section id="tutors" className="landing-theme-ice landing-section-line py-20 sm:py-24 lg:py-32">
        <div className="relative z-[1] mx-auto max-w-7xl px-5 lg:px-8">
          <Reveal><div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0"><ChapterEyebrow number="04" label="Meet the Tutors" />
              <h2 className="landing-section-title landing-ink mt-4 font-extrabold">Verified experts,<br />real <span className="landing-serif landing-accent">classrooms</span></h2></div>
            <Link href="/tutors" className="btn-dark shrink-0">All Tutors <ArrowRight size={16} /></Link></div></Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
            {tutors.slice(0, 3).map((c, i) => (
              <Reveal key={c.tutorId} delay={i * 0.08}>
                <Link href={`/tutors/${c.tutorId}`} className="card group block overflow-hidden transition hover:-translate-y-1.5 hover:shadow-card">
                  <div className="h-28 grad-bg relative"><div className="absolute inset-0 bg-navy-950/25" /></div>
                  <div className="relative px-6 pb-6">
                    <span className="-mt-9 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border-4 border-white text-xl font-extrabold text-white shadow-soft" data-tutor-avatar style={{ background: c.tutorColor }}>{c.tutorName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}</span>
                    <h3 className="landing-ink mt-4 flex items-center gap-1.5 text-[1.02rem] font-bold leading-snug group-hover:text-brand-600">{c.tutorName}<BadgeCheck size={16} className="shrink-0 text-brand-500" /></h3>
                    <p className="landing-copy mt-1 text-sm leading-6">{c.tutorTitle}</p>
                    <p className="landing-stat-label landing-muted mt-3 font-semibold uppercase">Tutoring: {c.title}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1}>
            <div className="landing-aurora-panel landing-sheen relative mt-12 overflow-hidden rounded-3xl p-6 text-white shadow-card sm:p-8 lg:mt-14 lg:p-12" data-panel-reveal data-sheen>
              <div className="pointer-events-none absolute -left-10 bottom-0 h-56 w-56 rounded-full bg-brand-500/30 blur-[90px]" data-parallax="9" />
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
      <section id="faq" className="landing-theme-dawn landing-section-line py-20 sm:py-24 lg:py-32">
        <div className="relative z-[1] mx-auto max-w-4xl px-5">
        <Reveal><div className="flex justify-center"><ChapterEyebrow number="05" label="Questions" center /></div>
          <h2 className="landing-section-title landing-ink mt-4 text-center font-extrabold">Questions, <span className="landing-serif landing-accent">answered</span></h2></Reveal>
        <div className="relative mt-12 space-y-3 lg:mt-14">
          <div className="landing-faq-spine" aria-hidden="true"><span data-line-grow-y /></div>
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <div className={`card landing-faq-card overflow-hidden ${faq === i ? "landing-faq-open" : ""}`}>
                <button onClick={() => setFaq(faq === i ? -1 : i)} className="landing-ink flex w-full items-center justify-between gap-4 p-5 text-left text-[0.98rem] font-bold leading-snug" aria-expanded={faq === i}><span className="flex min-w-0 items-baseline gap-3"><span className="landing-faq-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><span>{f.q}</span></span><ChevronDown className={`landing-accent shrink-0 transition duration-500 ${faq === i ? "rotate-180" : ""}`} /></button>
                {faq === i && <p className="landing-card-copy landing-copy landing-faq-answer px-5 pb-5 pl-[3.35rem] text-sm">{f.a}</p>}
              </div>
            </Reveal>
          ))}
        </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section id="begin" className="noise landing-theme-midnight landing-section-line relative overflow-hidden py-20 text-center text-white sm:py-24 lg:py-32">
        <div className="landing-cta-word" data-cta-word aria-hidden="true">BEYOND LIMITS</div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[720px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[130px]" data-parallax="7" />
        <div className="relative mx-auto max-w-3xl px-5">
          <div className="mb-8 flex justify-center"><ChapterEyebrow number="06" label="Begin" dark center /></div>
          <Reveal><div className="landing-cta-emblem" data-cta-emblem><Emblem size={72} /></div>
            <h2 className="landing-section-title landing-on-dark mx-auto mt-8 max-w-2xl font-black">Your future is one <span className="landing-gradient-text landing-serif" data-gradient-scrub>lesson</span> away.</h2>
            <p className="landing-lead landing-on-dark-copy mx-auto mt-5 max-w-xl">Join Elimu Bora today — free forever to start, premium when you want it all.</p>
            <Link href="/roles" className="btn-primary mt-8 !px-8 !py-3.5 !text-[0.95rem] sm:!px-9 sm:!py-4 sm:!text-base">Create Your Free Account <ArrowRight size={18} /></Link></Reveal>
        </div>
      </section>
      <Footer />
    </div>
  );
}

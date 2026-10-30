"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, initials } from "@/lib/client";
import { Loading } from "@/components/ui";

export default function Tutors() {
  const [courses, setCourses] = useState<any[]>([]);
  useEffect(() => { api("/api/courses").then(d => setCourses(d.courses)).catch(() => {}); }, []);
  const map = new Map<string, any>();
  courses.forEach(c => {
    const cur = map.get(c.tutorId) || { id: c.tutorId, name: c.tutorName, title: c.tutorTitle, color: c.tutorColor, courses: 0, students: 0 };
    cur.courses++; cur.students += c.enrolledCount; map.set(c.tutorId, cur);
  });
  const list = [...map.values()];
  return (
    <>
      <Navbar />
      <section className="bg-navy-950 pb-14 pt-32 text-white"><div className="mx-auto max-w-7xl px-5 lg:px-8">
        <h1 className="text-4xl font-extrabold lg:text-5xl">Our <span className="grad-text">Tutors</span></h1>
        <p className="mt-3 max-w-xl text-slate-300">Every Elimu Bora tutor is identity- and credential-verified before they can publish a single lesson.</p></div></section>
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        {courses.length === 0 ? <Loading /> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map(t => (
              <Link key={t.id} href={`/tutors/${t.id}`} className="card group p-7 text-center transition hover:-translate-y-1.5 hover:shadow-card">
                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-extrabold text-white" style={{ background: t.color }}>{initials(t.name)}</span>
                <h3 className="mt-4 flex items-center justify-center gap-1.5 font-extrabold group-hover:text-brand-600">{t.name}<BadgeCheck size={17} className="text-brand-500" /></h3>
                <p className="mt-1 text-sm text-slate-500">{t.title}</p>
                <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400"><BookOpen size={14} /> {t.courses} course{t.courses !== 1 ? "s" : ""} · {t.students} enrolments</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </>
  );
}

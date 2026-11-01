"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseCard from "@/components/CourseCard";
import { api, initials } from "@/lib/client";
import { Loading } from "@/components/ui";

export default function TutorProfile() {
  const { id } = useParams<{ id: string }>();
  const [courses, setCourses] = useState<any[]>([]);
  useEffect(() => { api(`/api/courses?tutor=${id}`).then(d => setCourses(d.courses.filter((c: any) => c.status === "published"))).catch(() => {}); }, [id]);
  const first = courses[0];
  return (
    <>
      <Navbar />
      <section className="bg-navy-950 pb-16 pt-32 text-white"><div className="mx-auto max-w-7xl px-5 lg:px-8">
        {!first ? <Loading /> : (
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl font-display text-h3 text-white" style={{ background: first.tutorColor }}>{initials(first.tutorName)}</span>
            <div>
              <h1 className="type-h2 flex items-center gap-2">{first.tutorName}<BadgeCheck className="text-brand-300" /></h1>
              <p className="type-lead mt-1 text-slate-300">{first.tutorTitle}</p>
              <p className="type-body-sm type-numeric mt-3 text-slate-400">{courses.length} published course{courses.length !== 1 ? "s" : ""} · {courses.reduce((a, c) => a + c.enrolledCount, 0)} total enrolments</p>
            </div>
          </div>
        )}
      </div></section>
      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <h2 className="type-h3">Courses by this tutor</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{courses.map(c => <CourseCard key={c.id} course={c} />)}</div>
      </section>
      <Footer />
    </>
  );
}

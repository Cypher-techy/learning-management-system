import Link from "next/link";
import { Star, PlayCircle, Clock, Crown, Users } from "lucide-react";
import { fmtDur } from "@/lib/client";
import { CoursePrice } from "./CoursePrice";

export default function CourseCard({ course }: { course: any }) {
  return (
    <Link href={`/courses/${course.id}`} className="group card block overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-navy-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={course.image} alt={course.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
        <span className={`chip absolute left-3 top-3 ${course.access === "premium" ? "grad-bg text-white" : "bg-emerald-500 text-white"}`}>
          {course.access === "premium" ? <><Crown size={12} /> {course.purchased ? "OWNED" : "PREMIUM"}</> : "FREE"}
        </span>
        <span className="type-caption type-numeric absolute bottom-3 left-3 flex items-center gap-1.5 font-medium text-white/90"><PlayCircle size={14} /> {course.lessonCount} lessons · {fmtDur(course.durationMin || 0)}</span>
      </div>
      <div className="p-5">
        <div className="type-eyebrow mb-2 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-brand-600">{course.category}</span><span className="shrink-0 text-slate-500">{course.level}</span>
        </div>
        <h3 className="type-card-title line-clamp-2 min-h-[2.7rem] text-slate-900 group-hover:text-brand-600">{course.title}</h3>
        <p className="type-body-sm mt-1 line-clamp-2 text-slate-600">{course.subtitle}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <CoursePrice course={course} className="font-display text-h5 font-bold text-slate-900" />
          <span className="type-caption pb-0.5 text-right font-medium text-slate-500">{course.access === "premium" ? (course.purchased ? "Lifetime access owned" : "One-off · lifetime access") : "Free access"}</span>
        </div>
        <div className="type-caption type-numeric mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-slate-600">
          <span className="min-w-0 truncate font-medium text-slate-700">{course.tutorName}</span>
          <span className="flex shrink-0 items-center gap-2.5">
            {course.rating ? <span className="flex items-center gap-1 font-semibold text-amber-600"><Star size={13} fill="currentColor" />{course.rating.toFixed(1)}</span> : null}
            <span className="flex items-center gap-1"><Users size={13} />{course.enrolledCount}</span>
            <span className="flex items-center gap-1"><Clock size={13} />{fmtDur(course.durationMin || 0)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

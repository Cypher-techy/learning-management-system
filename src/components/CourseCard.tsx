import Link from "next/link";
import { Star, PlayCircle, Clock, Crown, Users } from "lucide-react";
import { fmtDur } from "@/lib/client";

export default function CourseCard({ course }: { course: any }) {
  return (
    <Link href={`/courses/${course.id}`} className="group card block overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-card">
      <div className="relative aspect-[16/9] overflow-hidden bg-navy-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={course.image} alt={course.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
        <span className={`chip absolute left-3 top-3 ${course.access === "premium" ? "grad-bg text-white" : "bg-emerald-500 text-white"}`}>
          {course.access === "premium" ? <><Crown size={12} /> PREMIUM</> : "FREE"}
        </span>
        <span className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs font-medium text-white/90"><PlayCircle size={14} /> {course.lessonCount} lessons · {fmtDur(course.durationMin || 0)}</span>
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
          <span className="text-brand-600">{course.category}</span><span className="text-slate-400">{course.level}</span>
        </div>
        <h3 className="line-clamp-2 min-h-[3rem] font-bold leading-snug text-slate-900 group-hover:text-brand-600">{course.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.subtitle}</p>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{course.instructorName}</span>
          <span className="flex items-center gap-3">
            {course.rating ? <span className="flex items-center gap-1 font-bold text-amber-500"><Star size={13} fill="currentColor" />{course.rating.toFixed(1)}</span> : null}
            <span className="flex items-center gap-1"><Users size={13} />{course.enrolledCount}</span>
            <span className="flex items-center gap-1"><Clock size={13} />{fmtDur(course.durationMin || 0)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

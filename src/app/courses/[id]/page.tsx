"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, BookOpen, CheckCircle2, Clock, Crown, Lock, PlayCircle, Star, Users, ClipboardList, HelpCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { api, fmtDur, initials } from "@/lib/client";
import { Loading, ProgressBar } from "@/components/ui";

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [rating, setRating] = useState(5); const [comment, setComment] = useState("");

  async function load() { const d = await api(`/api/courses/${id}`).catch(() => null); setData(d); }
  useEffect(() => { load(); fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)); }, [id]);
  if (!data) return <><Navbar /><div className="pt-32"><Loading text="Loading course…" /></div></>;
  const c = data.course; const enr = data.enrollment;
  const progress = enr && c.lessonCount ? Math.round((enr.completedLessons.length / c.lessonCount) * 100) : 0;

  async function enrol() {
    setErr(""); setMsg("");
    if (!me) { router.push("/roles"); return; }
    try { await api(`/api/courses/${id}/enroll`, { method: "POST", body: "{}" }); setMsg("Enrolled! Taking you to the classroom…"); router.push(`/courses/${id}/learn`); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not enrol"); }
  }
  async function save(v: boolean) { try { await api(`/api/courses/${id}/enroll`, { method: "POST", body: JSON.stringify({ save: v }) }); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } }
  async function review() { try { await api(`/api/courses/${id}/review`, { method: "POST", body: JSON.stringify({ rating, comment }) }); setComment(""); setMsg("Thank you for your review."); load(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } }

  return (
    <>
      <Navbar />
      <section className="relative overflow-hidden bg-navy-950 pb-16 pt-32 text-white">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-brand-600/25 blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap gap-2"><span className="chip bg-white/10 text-brand-300">{c.category.toUpperCase()}</span><span className="chip bg-white/10">{c.level}</span>{c.access === "premium" ? <span className="chip grad-bg text-white"><Crown size={12} /> PREMIUM</span> : <span className="chip bg-emerald-500 text-white">FREE COURSE</span>}{c.tutorial && <span className="chip grad-bg text-white">TUTORIAL NOTES + EXAMPLES</span>}</div>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight lg:text-5xl">{c.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">{c.subtitle}</p>
            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-slate-300">
              {c.rating && <span className="flex items-center gap-1.5 font-bold text-amber-400"><Star size={16} fill="currentColor" />{c.rating.toFixed(1)} <span className="font-normal text-slate-400">({c.reviewCount} reviews)</span></span>}
              <span className="flex items-center gap-1.5"><Users size={16} />{c.enrolledCount} enrolled</span>
              <span className="flex items-center gap-1.5"><PlayCircle size={16} />{c.lessonCount} lessons</span>
              <span className="flex items-center gap-1.5"><Clock size={16} />{fmtDur(c.durationMin)}</span>
            </div>
            <Link href={`/tutors/${c.tutorId}`} className="mt-7 flex w-fit items-center gap-3 rounded-2xl bg-white/5 p-3 pr-5 transition hover:bg-white/10">
              <span className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-white" style={{ background: c.tutorColor }}>{initials(c.tutorName)}</span>
              <span><span className="flex items-center gap-1.5 text-sm font-bold">{c.tutorName}<BadgeCheck size={15} className="text-brand-300" /></span><span className="text-xs text-slate-400">{c.tutorTitle}</span></span>
            </Link>
          </div>
          <div className="lg:col-span-4">
            <div className="card overflow-hidden text-slate-900 shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.title} className="aspect-video w-full object-cover" />
              <div className="p-6">
                {err && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-600">{err}</p>}
                {msg && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{msg}</p>}
                {enr ? (
                  <>
                    <div className="mb-3 flex justify-between text-sm"><span className="font-semibold">Your progress</span><span className="font-bold">{progress}%</span></div>
                    <ProgressBar value={progress} />
                    <Link href={`/courses/${id}/learn`} className="btn-primary mt-5 w-full">{progress > 0 ? "Continue Learning" : "Start Learning"}</Link>
                    <button onClick={() => save(!enr.saved)} className="btn-light mt-3 w-full">{enr.saved ? "Remove from Saved" : "Save for Later"}</button>
                  </>
                ) : c.unlocked ? (
                  <button onClick={enrol} className="btn-primary w-full">Enrol Now {c.access === "free" ? "— Free" : ""}</button>
                ) : (
                  <>
                    <p className="flex items-center gap-2 font-bold"><Lock size={17} className="text-brand-600" /> Premium Course</p>
                    <p className="mt-2 text-sm text-slate-500">This course is included in Elimu Bora Premium — one subscription unlocks every premium course.</p>
                    <Link href={me ? "/dashboard/student/subscription" : "/plans"} className="btn-primary mt-5 w-full"><Crown size={16} /> Subscribe to Unlock</Link>
                    <p className="mt-3 text-center text-xs text-slate-400">Preview lessons below are free to watch.</p>
                  </>
                )}
                <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-5 text-sm text-slate-600">
                  <li className="flex gap-2"><PlayCircle size={17} className="text-brand-500" />{c.lessonCount} lessons · {fmtDur(c.durationMin)} total</li>
                  {c.tutorial && <li className="flex gap-2"><BookOpen size={17} className="text-brand-500" />Step-by-step notes, examples & exercises (tutorial format)</li>}
                  <li className="flex gap-2"><ClipboardList size={17} className="text-brand-500" />{data.assignments.length} assignments · {data.quizzes.length} quizzes</li>
                  <li className="flex gap-2"><BookOpen size={17} className="text-brand-500" />Discussions & tutor messages</li>
                  <li className="flex gap-2"><CheckCircle2 size={17} className="text-brand-500" />Verifiable certificate on completion</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-8">
          <h2 className="text-2xl font-extrabold">About this course</h2>
          <p className="mt-4 leading-relaxed text-slate-600">{c.description}</p>
          <h3 className="mt-10 text-xl font-extrabold">What you will learn</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{c.objectives.map((o: string) => <p key={o} className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={18} className="shrink-0 text-emerald-500" />{o}</p>)}</div>
          {c.requirements?.length > 0 && (<><h3 className="mt-10 text-xl font-extrabold">Requirements</h3><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{c.requirements.map((r: string) => <li key={r}>{r}</li>)}</ul></>)}

          <h3 className="mt-12 text-xl font-extrabold">Curriculum</h3>
          <div className="mt-4 space-y-4">
            {c.sections.map((s: any, si: number) => (
              <div key={s.id} className="card overflow-hidden">
                <p className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 font-bold">Section {si + 1}: {s.title}</p>
                {s.lessons.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 border-b border-slate-50 px-5 py-3 last:border-0">
                    {c.unlocked || l.isPreview ? <PlayCircle size={18} className="text-brand-500" /> : <Lock size={16} className="text-slate-300" />}
                    <span className="flex-1 text-sm font-medium">{l.title}</span>
                    {l.isPreview && <span className="chip bg-sky-100 text-sky-700">FREE PREVIEW</span>}
                    <span className="text-xs text-slate-400">{l.durationMin} min</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {(data.quizzes.length > 0 || data.assignments.length > 0) && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {data.quizzes.map((q: any) => <div key={q.id} className="card flex items-center gap-3 p-4"><HelpCircle className="text-brand-500" /><div><p className="text-sm font-bold">{q.title}</p><p className="text-xs text-slate-500">{q.questions.length} questions · {q.timeLimitMin} min · pass {q.passMark}%</p></div></div>)}
              {data.assignments.map((a: any) => <div key={a.id} className="card flex items-center gap-3 p-4"><ClipboardList className="text-brand-500" /><div><p className="text-sm font-bold">{a.title}</p><p className="text-xs text-slate-500">Due {a.dueDate} · {a.maxScore} marks</p></div></div>)}
            </div>
          )}

          <h3 className="mt-12 text-xl font-extrabold">Student reviews</h3>
          <div className="mt-4 space-y-4">
            {data.reviews.length === 0 ? <p className="text-sm text-slate-500">No reviews yet — be the first after enrolling.</p> :
              data.reviews.map((r: any) => (
                <div key={r.id} className="card p-5"><div className="flex items-center justify-between"><p className="font-bold">{r.studentName}</p><span className="flex text-amber-400">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} size={15} fill="currentColor" />)}</span></div><p className="mt-2 text-sm text-slate-600">{r.comment}</p></div>
              ))}
          </div>
          {enr && (
            <div className="card mt-6 p-5">
              <p className="font-bold">Rate this course</p>
              <div className="mt-3 flex items-center gap-3">
                <select className="input !w-auto" value={rating} onChange={e => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}</select>
                <input className="input" placeholder="Share your experience…" value={comment} onChange={e => setComment(e.target.value)} />
                <button className="btn-dark shrink-0" onClick={review}>Submit</button>
              </div>
            </div>
          )}
        </div>
        <aside className="lg:col-span-4">
          <div className="card sticky top-24 p-6">
            <h3 className="font-extrabold">Course discussions</h3>
            <div className="mt-4 space-y-3">
              {data.discussions.slice(0, 4).map((d: any) => <div key={d.id} className="rounded-xl bg-slate-50 p-3.5"><p className="text-sm font-bold">{d.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{d.body}</p></div>)}
              {data.discussions.length === 0 && <p className="text-sm text-slate-500">Discussions open once you enrol.</p>}
            </div>
            {enr && <Link href={`/courses/${id}/learn?tab=community`} className="btn-light mt-4 w-full">Join the discussion</Link>}
          </div>
        </aside>
      </section>
      <Footer />
    </>
  );
}

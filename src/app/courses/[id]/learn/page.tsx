"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, ClipboardList, Crown, FileText, HelpCircle, Lock, MessageSquare, PlayCircle, Send, Sparkles, Trophy, Flag } from "lucide-react";
import { api, fmtDate } from "@/lib/client";
import { Loading, ProgressBar } from "@/components/ui";
import { Logo } from "@/components/Logo";

type Tab = "learn" | "quizzes" | "assignments" | "community" | "assistant";

function LearnInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) || "learn");
  const [lessonId, setLessonId] = useState<string>("");
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [activeQuiz, setActiveQuiz] = useState<string>("");
  const [subText, setSubText] = useState<Record<string, string>>({});
  const [cert, setCert] = useState<any>(null);
  const [question, setQuestion] = useState(""); const [aiAnswer, setAiAnswer] = useState(""); const [aiBusy, setAiBusy] = useState(false);
  const [newThread, setNewThread] = useState({ title: "", body: "" });
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [discussions, setDiscussions] = useState<any[]>([]);
  const startRef = useRef(Date.now());

  async function load() {
    const d = await api(`/api/courses/${id}`).catch(() => null);
    setData(d);
    if (d) {
      const all = d.course.sections.flatMap((s: any) => s.lessons);
      const resume = d.enrollment?.lastLessonId && all.some((l: any) => l.id === d.enrollment.lastLessonId) ? d.enrollment.lastLessonId : all[0]?.id;
      setLessonId(prev => prev || resume);
      const disc = await api(`/api/discussions?courseId=${id}`).catch(() => ({ discussions: [] }));
      setDiscussions(disc.discussions || []);
    }
  }
  useEffect(() => { load(); fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)); }, [id]);
  // Track gentle active minutes for engagement-based revenue (capped server-side)
  useEffect(() => {
    const t = setInterval(async () => {
      if (lessonId && data?.enrollment) api(`/api/courses/${id}/progress`, { method: "POST", body: JSON.stringify({ lessonId, activeMin: 1 }) }).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, [lessonId, data?.enrollment, id]);

  if (!data) return <div className="p-10"><Loading text="Opening your classroom…" /></div>;
  const c = data.course; const enr = data.enrollment;
  const allLessons = c.sections.flatMap((s: any) => s.lessons.map((l: any) => ({ ...l, section: s.title })));
  const lesson = allLessons.find((l: any) => l.id === lessonId) || allLessons[0];
  const progress = enr && c.lessonCount ? Math.round((enr.completedLessons.length / c.lessonCount) * 100) : 0;
  const lessonLocked = !c.unlocked && !lesson?.isPreview;

  if (!me) return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 p-6"><div className="card max-w-md p-10 text-center">
      <h1 className="text-2xl font-extrabold">Sign in to learn</h1><p className="mt-3 text-sm text-slate-500">You need a student account to enter the classroom.</p>
      <Link href="/roles" className="btn-primary mt-6 w-full">Sign In / Register</Link></div></div>
  );
  if (!enr && me.role === "student") return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 p-6"><div className="card max-w-md p-10 text-center">
      <h1 className="text-2xl font-extrabold">Enrol to enter the classroom</h1>
      <p className="mt-3 text-sm text-slate-500">{c.unlocked ? "Enrol from the course page to start tracking your progress." : "This is a Premium course. Subscribe once to unlock every premium course."}</p>
      <div className="mt-6 flex gap-3"><Link href={`/courses/${id}`} className="btn-light flex-1">Course Page</Link>{!c.unlocked && <Link href="/dashboard/student/subscription" className="btn-primary flex-1"><Crown size={16} /> Go Premium</Link>}</div></div></div>
  );

  async function completeLesson() {
    try { await api(`/api/courses/${id}/progress`, { method: "POST", body: JSON.stringify({ lessonId: lesson.id, complete: true }) }); setMsg("Lesson marked complete. Keep going!"); load(); const idx = allLessons.findIndex((l: any) => l.id === lesson.id); if (allLessons[idx + 1]) setLessonId(allLessons[idx + 1].id); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function submitQuiz(q: any) {
    setErr("");
    try { const r = await api(`/api/quizzes/${q.id}/attempt`, { method: "POST", body: JSON.stringify({ answers }) }); setQuizResult({ quizId: q.id, ...r }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function submitAssignment(a: any) {
    try { await api(`/api/assignments/${a.id}/submit`, { method: "POST", body: JSON.stringify({ content: subText[a.id] }) }); setMsg("Assignment submitted."); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function claimCert() {
    setErr(""); setMsg("");
    try { const r = await api(`/api/courses/${id}/certificate`, { method: "POST", body: "{}" }); setCert(r.certificate); setMsg("Certificate issued — hongera!"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function askAI(mode = "ask") {
    setAiBusy(true); setAiAnswer("");
    try { const r = await api("/api/assistant", { method: "POST", body: JSON.stringify({ courseId: id, question, mode }) }); setAiAnswer(r.answer); }
    catch (e) { setAiAnswer(e instanceof Error ? e.message : "Assistant unavailable."); }
    finally { setAiBusy(false); }
  }
  async function postThread() {
    if (!newThread.title.trim() || !newThread.body.trim()) return;
    try { await api("/api/discussions", { method: "POST", body: JSON.stringify({ courseId: id, ...newThread }) }); setNewThread({ title: "", body: "" }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function postReply(discId: string) {
    if (!replyText[discId]?.trim()) return;
    try { await api(`/api/discussions/${discId}/replies`, { method: "POST", body: JSON.stringify({ body: replyText[discId] }) }); setReplyText({ ...replyText, [discId]: "" }); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  async function report(discId: string) {
    try { await api("/api/reports", { method: "POST", body: JSON.stringify({ targetType: "discussion", targetId: discId, reason: "Reported from course community for moderation review." }) }); setMsg("Reported to moderators."); } catch {}
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "learn", label: "Lessons", icon: <BookOpen size={16} /> },
    { id: "quizzes", label: "Quizzes", icon: <HelpCircle size={16} /> },
    { id: "assignments", label: "Assignments", icon: <ClipboardList size={16} /> },
    { id: "community", label: "Community", icon: <MessageSquare size={16} /> },
    { id: "assistant", label: "Study Assistant", icon: <Sparkles size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 bg-navy-950 px-5 text-white">
        <button onClick={() => router.push(me.role === "student" ? "/dashboard/student/learning" : `/courses/${id}`)} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={17} /> Exit</button>
        <span className="hidden sm:block"><Logo href="/" /></span>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden items-center gap-3 md:flex"><span className="text-xs text-slate-400">{progress}% complete</span><ProgressBar value={progress} className="w-36 !bg-white/15" /></div>
          {progress === 100 && <button onClick={claimCert} className="btn-primary !px-4 !py-2 !text-xs"><Trophy size={14} /> Claim Certificate</button>}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{c.category}</p>
        <h1 className="mt-1 text-2xl font-extrabold lg:text-3xl">{c.title}</h1>
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700">{msg}</p>}
        {err && <p className="mt-4 rounded-xl bg-rose-50 p-3.5 text-sm font-medium text-rose-600">{err}</p>}
        {cert && <p className="mt-4 rounded-xl bg-navy-900 p-4 text-sm text-white">Certificate <strong>{cert.code}</strong> issued. View and print it from <Link className="underline" href="/dashboard/student/certificates">My Certificates</Link>.</p>}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" role="tablist">
          {tabs.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "grad-bg text-white shadow-glow" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>{t.icon}{t.label}</button>)}
        </div>

        {tab === "learn" && (
          <div className="mt-5 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="card overflow-hidden">
                {lessonLocked ? (
                  <div className="flex aspect-video flex-col items-center justify-center bg-navy-950 p-8 text-center text-white">
                    <Lock size={40} className="text-brand-300" /><h3 className="mt-4 text-xl font-extrabold">Premium lesson</h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-300">Subscribe to EDVORA Premium to unlock this and every other premium lesson.</p>
                    <Link href="/dashboard/student/subscription" className="btn-primary mt-6"><Crown size={16} /> Subscribe to Unlock</Link>
                  </div>
                ) : lesson?.videoUrl ? (
                  <div className="aspect-video bg-black"><iframe src={lesson.videoUrl} title={lesson.title} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-navy-900 text-white"><FileText size={44} className="text-brand-300" /></div>
                )}
                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{lesson?.section}</p>
                  <h2 className="mt-1.5 text-xl font-extrabold">{lesson?.title}</h2>
                  {!lessonLocked && <p className="mt-3 leading-relaxed text-slate-600">{lesson?.body}</p>}
                  {lesson?.resourceUrl && !lessonLocked && <a href={lesson.resourceUrl} target="_blank" rel="noreferrer" className="btn-light mt-4"><FileText size={15} /> {lesson.resourceName || "Download resource"}</a>}
                  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
                    {!enr?.completedLessons.includes(lesson?.id)
                      ? <button onClick={completeLesson} disabled={lessonLocked} className="btn-primary"><CheckCircle2 size={17} /> Mark Complete & Continue</button>
                      : <span className="chip bg-emerald-100 !px-4 !py-2 text-emerald-700"><CheckCircle2 size={15} /> COMPLETED</span>}
                    <Link href={`/courses/${id}`} className="btn-light">Course Overview</Link>
                  </div>
                </div>
              </div>
            </div>
            <aside className="lg:col-span-4">
              <div className="card overflow-hidden">
                <p className="border-b border-slate-100 bg-slate-50 px-5 py-3.5 font-bold">Course content · {progress}%</p>
                <div className="max-h-[560px] overflow-y-auto">
                  {c.sections.map((s: any) => (
                    <div key={s.id}>
                      <p className="bg-slate-50/60 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400">{s.title}</p>
                      {s.lessons.map((l: any) => {
                        const done = enr?.completedLessons.includes(l.id); const locked = !c.unlocked && !l.isPreview;
                        return (
                          <button key={l.id} onClick={() => { setLessonId(l.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`flex w-full items-center gap-3 border-b border-slate-50 px-5 py-3 text-left transition ${lesson?.id === l.id ? "bg-brand-500/5" : "hover:bg-slate-50"}`}>
                            {locked ? <Lock size={16} className="shrink-0 text-slate-300" /> : done ? <CheckCircle2 size={17} className="shrink-0 text-emerald-500" /> : <PlayCircle size={17} className="shrink-0 text-brand-500" />}
                            <span className="flex-1 text-sm font-medium">{l.title}</span>
                            <span className="text-xs text-slate-400">{l.durationMin}m</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        )}

        {tab === "quizzes" && (
          <div className="mt-5 space-y-5">
            {data.quizzes.length === 0 && <div className="card p-8 text-sm text-slate-500">No quizzes in this course yet.</div>}
            {data.quizzes.map((q: any) => (
              <div key={q.id} className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-extrabold">{q.title}</h3><p className="text-xs text-slate-500">{q.questions.length} questions · {q.timeLimitMin} min limit · pass mark {q.passMark}% · max {q.maxAttempts} attempts</p></div>
                  {activeQuiz !== q.id && <button className="btn-dark" onClick={() => { setActiveQuiz(q.id); setQuizResult(null); setAnswers({}); }}>Start / Retake</button>}</div>
                {quizResult?.quizId === q.id && (
                  <div className={`mt-4 rounded-xl p-4 text-sm ${quizResult.attempt.passed ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                    <strong>Result: {quizResult.attempt.score}/{quizResult.attempt.total}</strong> — {quizResult.attempt.passed ? "Passed. Hongera!" : "Not yet at the pass mark."} {quizResult.attempt.manualPending ? "Short-answer responses await instructor review." : ""} Attempts left: {quizResult.attemptsLeft}
                    <ul className="mt-3 space-y-2">{quizResult.feedback.map((f: any, i: number) => <li key={i} className="rounded-lg bg-white/70 p-3">Q{i + 1}: {f.correct === null ? "Pending manual grading" : f.correct ? "Correct" : `Incorrect — answer: ${f.correctAnswer}`}<br /><span className="text-xs opacity-80">{f.explanation}</span></li>)}</ul>
                  </div>
                )}
                {activeQuiz === q.id && (
                  <div className="mt-5 space-y-5">
                    {q.questions.map((qq: any, i: number) => (
                      <fieldset key={qq.id} className="rounded-xl bg-slate-50 p-4">
                        <legend className="px-1 text-sm font-bold">{i + 1}. {qq.prompt}</legend>
                        {qq.type === "short"
                          ? <textarea className="input mt-2" rows={2} value={answers[qq.id] || ""} onChange={e => setAnswers({ ...answers, [qq.id]: e.target.value })} placeholder="Type your answer…" />
                          : <div className="mt-2 space-y-2">{(qq.options || []).map((o: string) => <label key={o} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white p-2.5 text-sm"><input type="radio" name={qq.id} checked={answers[qq.id] === o} onChange={() => setAnswers({ ...answers, [qq.id]: o })} />{o}</label>)}</div>}
                      </fieldset>
                    ))}
                    <button className="btn-primary" onClick={() => { setActiveQuiz(""); submitQuiz(q); }}>Submit Quiz</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "assignments" && (
          <div className="mt-5 space-y-5">
            {data.assignments.length === 0 && <div className="card p-8 text-sm text-slate-500">No assignments in this course yet.</div>}
            {data.assignments.map((a: any) => (
              <div key={a.id} className="card p-6">
                <div className="flex flex-wrap justify-between gap-2"><h3 className="font-extrabold">{a.title}</h3><span className="chip bg-amber-100 text-amber-700">DUE {fmtDate(a.dueDate)}</span></div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{a.instructions}</p>
                <p className="mt-1 text-xs text-slate-400">Maximum score: {a.maxScore}</p>
                <textarea className="input mt-4" rows={4} placeholder="Write your submission here (paste links to deployed work, code, or your written answer)…" value={subText[a.id] || ""} onChange={e => setSubText({ ...subText, [a.id]: e.target.value })} />
                <button className="btn-dark mt-3" onClick={() => submitAssignment(a)}><Send size={15} /> Submit Assignment</button>
              </div>
            ))}
          </div>
        )}

        {tab === "community" && (
          <div className="mt-5 grid gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              {discussions.map((d: any) => (
                <div key={d.id} className="card p-6">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{d.title}</h3><p className="text-xs text-slate-400">by {d.authorName} · {fmtDate(d.createdAt)}</p></div>
                    <button onClick={() => report(d.id)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500"><Flag size={13} /> Report</button></div>
                  <p className="mt-2 text-sm text-slate-600">{d.body}</p>
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    {d.replies.map((r: any) => <div key={r.id} className="rounded-xl bg-slate-50 p-3.5"><p className="text-xs font-bold">{r.authorName} <span className="font-normal text-slate-400">· {fmtDate(r.createdAt)}</span></p><p className="mt-1 text-sm text-slate-600">{r.body}</p></div>)}
                    <div className="flex gap-2"><input className="input" placeholder="Write a reply…" value={replyText[d.id] || ""} onChange={e => setReplyText({ ...replyText, [d.id]: e.target.value })} /><button className="btn-dark shrink-0" onClick={() => postReply(d.id)}>Reply</button></div>
                  </div>
                </div>
              ))}
              {discussions.length === 0 && <div className="card p-8 text-sm text-slate-500">No discussions yet — start the first one.</div>}
            </div>
            <aside className="lg:col-span-4"><div className="card sticky top-24 p-6">
              <h3 className="font-extrabold">Start a discussion</h3>
              <input className="input mt-4" placeholder="Discussion title" value={newThread.title} onChange={e => setNewThread({ ...newThread, title: e.target.value })} />
              <textarea className="input mt-3" rows={4} placeholder="Ask a question or share an idea…" value={newThread.body} onChange={e => setNewThread({ ...newThread, body: e.target.value })} />
              <button className="btn-primary mt-4 w-full" onClick={postThread}>Post Discussion</button>
            </div></aside>
          </div>
        )}

        {tab === "assistant" && (
          <div className="card mx-auto mt-5 max-w-3xl p-6 lg:p-8">
            <h3 className="flex items-center gap-2 font-extrabold"><Sparkles className="text-brand-500" /> EDVORA Study Assistant</h3>
            <p className="mt-2 text-sm text-slate-500">Ask about this course. The assistant only uses lesson material you are entitled to access{c.access === "premium" && !c.unlocked ? " (free previews only on your current plan)" : ""}.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input className="input" placeholder="e.g. Explain how Flexbox centring works" value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} />
              <button className="btn-primary shrink-0" disabled={aiBusy} onClick={() => askAI()}>{aiBusy ? "Thinking…" : "Ask"}</button>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-light !py-2 !text-xs" onClick={() => askAI("summarise")}>Summarise my material</button>
              <button className="btn-light !py-2 !text-xs" onClick={() => askAI("practice")}>Generate practice questions</button>
            </div>
            {aiAnswer && <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-navy-950 p-5 text-sm leading-relaxed text-slate-200">{aiAnswer}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LearnPage() { return <Suspense fallback={<Loading />}><LearnInner /></Suspense>; }

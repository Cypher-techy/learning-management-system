"use client";
import Link from "next/link";
import { useApi, fmtDate } from "@/lib/client";
import { Loading, Empty, PageTitle } from "@/components/ui";
export default function Quizzes() {
  const { data, loading, error } = useApi("/api/overview/student");
  if (loading) return <Loading />; if (error || !data) return <p className="text-rose-600">{error}</p>;
  return (
    <div>
      <PageTitle title="Quizzes & Results" sub="Your assessments across enrolled courses, with attempt history." />
      {data.quizzes.length === 0 ? <Empty title="No quizzes yet" body="Quizzes from your courses will appear here." /> : (
        <div className="space-y-4">
          {data.quizzes.map((q: any) => (
            <div key={q.id} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-extrabold">{q.title}</h3><p className="text-xs text-slate-500">{q.courseTitle} · {q.timeLimitMin} min · {q.attempts.length}/{q.maxAttempts} attempts used</p></div>
                <Link href={`/courses/${q.courseId}/learn?tab=quizzes`} className="btn-dark !py-2 !text-xs">{q.attempts.length ? "Retake in Classroom" : "Take Quiz"}</Link>
              </div>
              {q.attempts.length > 0 && <div className="mt-4 space-y-2">{q.attempts.map((a: any) => (
                <div key={a.id} className={`flex flex-wrap items-center justify-between rounded-xl p-3.5 text-sm ${a.passed ? "bg-emerald-50" : "bg-amber-50"}`}>
                  <span><strong>{a.score}/{a.total}</strong> ({a.total ? Math.round(a.score / a.total * 100) : 0}%) — {a.passed ? "Passed" : "Not passed"}{a.manualPending ? " · short answers pending review" : ""}</span>
                  <span className="text-xs text-slate-500">{fmtDate(a.submittedAt)}</span>
                </div>))}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useApi, fmtDate } from "@/lib/client";
import { Loading, Empty, PageTitle, StatusChip } from "@/components/ui";
export default function Assignments() {
  const { data, loading, error } = useApi("/api/overview/student");
  if (loading) return <Loading />; if (error || !data) return <p className="text-rose-600">{error}</p>;
  return (
    <div>
      <PageTitle title="Assignments" sub="Instructions, due dates, submissions, grades and tutor feedback." />
      {data.assignments.length === 0 ? <Empty title="No assignments yet" body="Assignments from your enrolled courses will appear here." /> : (
        <div className="space-y-4">
          {data.assignments.map((a: any) => (
            <div key={a.id} className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="font-extrabold">{a.title}</h3><p className="text-xs text-slate-500">{a.courseTitle} · Due {fmtDate(a.dueDate)} · Max {a.maxScore} marks</p></div>
                {a.submission ? <StatusChip status={a.submission.status} /> : <span className="chip bg-slate-200 text-slate-600">NOT SUBMITTED</span>}
              </div>
              <p className="mt-3 text-sm text-slate-600">{a.instructions}</p>
              {a.submission ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                  <p><strong>Your submission</strong> · {fmtDate(a.submission.submittedAt)}</p>
                  <p className="mt-1 text-slate-600">{a.submission.content}</p>
                  {a.submission.status === "graded" && <p className="mt-3 rounded-lg bg-emerald-50 p-3"><strong>Grade: {a.submission.grade}/{a.maxScore}</strong><br />{a.submission.feedback}</p>}
                </div>
              ) : <Link href={`/courses/${a.courseId}/learn?tab=assignments`} className="btn-dark mt-4 !py-2 !text-xs">Open in Classroom & Submit</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

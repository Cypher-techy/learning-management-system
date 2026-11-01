"use client";
import Link from "next/link";
import { Printer, Trophy } from "lucide-react";
import { useApi, fmtDate } from "@/lib/client";
import { Loading, Empty, PageTitle } from "@/components/ui";
import { Emblem } from "@/components/Logo";
import { Technical } from "@/components/Typography";

export default function Certificates() {
  const { data, loading, error } = useApi("/api/overview/student");
  if (loading) return <Loading />; if (error || !data) return <p className="text-rose-600">{error}</p>;
  const eligible = data.myCourses.filter((c: any) => c.progress === 100 && !data.certificates.some((x: any) => x.courseId === c.id && !x.revoked));
  return (
    <div>
      <PageTitle title="My Certificates" sub="Earned through completed lessons and passed assessments. Each certificate is publicly verifiable." />
      {eligible.length > 0 && <div className="card mb-6 border-emerald-200 bg-emerald-50 p-5"><p className="font-bold text-emerald-800">You have finished {eligible.map((c: any) => `"${c.title}"`).join(", ")}.</p><p className="text-sm text-emerald-700">Open the course classroom and use "Claim Certificate" — quiz requirements are checked automatically.</p>
        <div className="mt-3 flex gap-2">{eligible.map((c: any) => <Link key={c.id} href={`/courses/${c.id}/learn`} className="btn-dark !py-2 !text-xs">Claim for {c.title}</Link>)}</div></div>}
      {data.certificates.length === 0 ? <Empty title="No certificates yet" body="Complete 100% of a course's lessons and pass its quizzes to earn your first certificate." action={<Link href="/dashboard/student/learning" className="btn-primary">Go to My Learning</Link>} /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          {data.certificates.map((cert: any) => (
            <div key={cert.id} className="certificate-sheet overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
              <div className="relative bg-navy-950 p-7 text-center text-white">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-600/30 to-transparent" />
                <div className="relative flex justify-center"><Emblem size={52} /></div>
                <p className="brand-wordmark relative mt-3">ELIMU Bora</p>
                <p className="brand-tagline relative mt-1 text-slate-400">LEARN BEYOND LIMITS.</p>
                <p className="type-eyebrow relative mt-5 text-brand-300">Certificate of Completion</p>
              </div>
              <div className="p-7 text-center">
                <p className="type-caption text-slate-500">This certifies that</p>
                <p className="type-h3 mt-1">{data.user.fullName}</p>
                <p className="type-body-sm mt-2 text-slate-600">has successfully completed</p>
                <p className="type-h5 mt-1 text-brand-600">{cert.courseTitle}</p>
                <p className="type-caption mt-3 text-slate-600">Tutor: {cert.tutorName} · Issued {fmtDate(cert.issuedAt)}</p>
                <p className="type-caption mt-2 font-medium">Reference: <Technical>{cert.code}</Technical>{cert.revoked ? " · REVOKED" : ""}</p>
                <div className="mt-5 flex justify-center gap-2">
                  <button onClick={() => window.print()} className="btn-dark !py-2 !text-xs"><Printer size={14} /> Print / Save PDF</button>
                  <Link href={`/verify?code=${cert.code}`} className="btn-light !py-2 !text-xs"><Trophy size={14} /> Public Verification</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

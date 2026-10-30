"use client";
import Link from "next/link";
import { BookOpenCheck, Crown, Flag, GraduationCap, Landmark, Users, Wallet } from "lucide-react";
import { useApi, kes, fmtDate } from "@/lib/client";
import { Stat, Loading, StatusChip } from "@/components/ui";

export default function AdminHome() {
  const { data, loading, error } = useApi("/api/overview/admin");
  if (loading) return <Loading />; if (error || !data) return <p className="text-rose-600">{error}</p>;
  const s = data.stats;
  const queue = [
    { label: "Tutor applications pending", value: s.pendingTutors, href: "/dashboard/admin/tutors", icon: <GraduationCap size={19} /> },
    { label: "Courses awaiting review", value: s.coursesInReview, href: "/dashboard/admin/courses", icon: <BookOpenCheck size={19} /> },
    { label: "Withdrawal requests pending", value: s.pendingWithdrawals, href: "/dashboard/admin/finance", icon: <Wallet size={19} /> },
    { label: "Open reports", value: s.openReports, href: "/dashboard/admin/reports", icon: <Flag size={19} /> },
  ];
  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-navy-900 p-7 text-white lg:p-9">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-600/40 blur-[80px]" />
        <p className="relative text-sm text-slate-300">Platform operations</p>
        <h1 className="relative mt-1 text-3xl font-extrabold">Administration Overview</h1>
        <p className="relative mt-2 text-sm text-slate-300">Verification, moderation, subscriptions and finance — every action is audit-logged.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Students" value={s.students} sub={`${s.verifiedStudents} verified`} icon={<Users size={19} />} />
        <Stat label="Tutors" value={s.tutors} sub={`${s.verifiedTutors} verified · ${s.pendingTutors} pending`} icon={<GraduationCap size={19} />} />
        <Stat label="Active Subscriptions" value={s.activeSubscriptions} sub={`${s.expiredSubscriptions} expired/inactive`} icon={<Crown size={19} />} />
        <Stat label="Collected Revenue" value={kes(s.revenueKES)} sub={`${s.failedPayments} failed payments`} icon={<Landmark size={19} />} />
      </div>
      <h2 className="mb-4 mt-10 text-xl font-extrabold">Action queues</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {queue.map(q => (
          <Link key={q.label} href={q.href} className={`card p-5 transition hover:-translate-y-0.5 hover:shadow-card ${q.value > 0 ? "border-amber-300" : ""}`}>
            <span className="text-brand-600">{q.icon}</span><p className="mt-3 text-3xl font-extrabold">{q.value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">{q.label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        <div className="card p-6 lg:col-span-7">
          <h3 className="font-extrabold">Recent payments</h3>
          <div className="table-wrap mt-4"><table className="edv"><thead><tr><th>Date</th><th>Student</th><th>Amount</th><th>Receipt</th><th>Status</th></tr></thead>
            <tbody>{data.payments.slice(0, 6).map((p: any) => <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td className="font-semibold">{p.studentName}</td><td>{kes(p.amount)}</td><td className="font-mono text-xs">{p.mpesaReceipt || "—"}</td><td><StatusChip status={p.status} /></td></tr>)}</tbody></table></div>
        </div>
        <div className="card p-6 lg:col-span-5">
          <h3 className="font-extrabold">Recent audit activity</h3>
          <div className="mt-4 space-y-2.5">
            {data.auditLogs.slice(0, 6).map((a: any) => <div key={a.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{a.action}</p><p className="text-xs text-slate-500">{a.actorName} · {fmtDate(a.createdAt)}{a.reason ? ` · ${a.reason}` : ""}</p></div>)}
          </div>
          <Link href="/dashboard/admin/audit" className="btn-light mt-4 w-full">Full Audit Log</Link>
        </div>
      </div>
    </div>
  );
}

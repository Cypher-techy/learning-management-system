import { getDB, persist, uid, now, audit, notify, courseLessons } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";

/** Usage-based revenue allocation. Teacher pool = net distributable revenue x
 *  configured teacher %. Individual shares are weighted by verified premium
 *  engagement (completed premium lessons x weight + active learning minutes),
 *  never raw page views. A period can only be allocated once. */
export async function POST(req: Request) {
  try {
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = getDB();
    const { periodId, refunds = 0, fees = 0, taxes = 0 } = await req.json();
    const period = db.revenuePeriods.find(p => p.id === periodId);
    if (!period) throw new ApiError(404, "Revenue period not found.");
    if (period.allocated) throw new ApiError(400, "This period has already been allocated — revenue is never distributed twice.");
    const gross = db.payments.filter(p => p.status === "completed" && p.completedAt && p.completedAt >= period.startsAt && p.completedAt <= period.endsAt + "T23:59:59")
      .reduce((a, p) => a + p.amount, 0);
    const net = Math.max(gross - refunds - fees - taxes, 0);
    const teacherPercent = db.settings.teacherPercent;
    const pool = Math.round(net * (teacherPercent / 100));
    // Engagement weights per teacher (premium courses only)
    const weights = new Map<string, number>();
    for (const enr of db.enrollments) {
      const course = db.courses.find(c => c.id === enr.courseId);
      if (!course || course.access !== "premium") continue;
      const student = db.users.find(u => u.id === enr.studentId);
      if (!student || student.plan !== "premium") continue;
      const w = enr.completedLessons.length * 10 + Math.min(enr.activeMin, 600);
      weights.set(course.instructorId, (weights.get(course.instructorId) || 0) + w);
    }
    const totalW = [...weights.values()].reduce((a, b) => a + b, 0);
    const allocations: { teacherId: string; amount: number; weight: number }[] = [];
    if (pool > 0 && totalW > 0) {
      for (const [teacherId, w] of Array.from(weights.entries())) {
        const amount = Math.floor(pool * (w / totalW));
        if (amount <= 0) continue;
        allocations.push({ teacherId, amount, weight: w });
        db.walletTxs.unshift({ id: uid("w_"), teacherId, type: "earning", amount, note: `${period.label} allocation — ${Math.round((w / totalW) * 100)}% of premium engagement`, createdAt: now(), periodId: period.id });
        notify(teacherId, "Earnings allocated", `${period.label}: KSh ${amount.toLocaleString()} added to your wallet.`, "/dashboard/teacher/earnings");
      }
    }
    Object.assign(period, { gross, refunds, fees, taxes, net, teacherPool: pool, platformShare: net - pool, teacherPercent, allocated: true, allocatedAt: now() });
    audit(actor.id, "revenue.allocated", period.id, `gross ${gross} net ${net} pool ${pool}`);
    persist();
    return Response.json({ ok: true, period, allocations });
  } catch (e) { return jsonError(e); }
}

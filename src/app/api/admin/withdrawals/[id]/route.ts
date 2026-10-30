import { getDB, persist, uid, now, audit, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
import { wallet } from "@/lib/overview";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = getDB();
    const wd = db.withdrawals.find(w => w.id === id);
    if (!wd) throw new ApiError(404, "Withdrawal not found.");
    const { action, payoutRef, note } = await req.json();
    if (action === "approve") {
      if (wd.status !== "pending") throw new ApiError(400, "Only pending withdrawals can be approved.");
      wd.status = "approved"; wd.decidedBy = actor.id; wd.note = note;
      audit(actor.id, "withdrawal.approved", wd.id, note);
      notify(wd.teacherId, "Withdrawal approved", `Your withdrawal of KSh ${wd.amount.toLocaleString()} has been approved and is being processed.`, "/dashboard/teacher/earnings");
    } else if (action === "reject") {
      if (wd.status !== "pending") throw new ApiError(400, "Only pending withdrawals can be rejected.");
      wd.status = "rejected"; wd.decidedBy = actor.id; wd.note = note;
      audit(actor.id, "withdrawal.rejected", wd.id, note);
      notify(wd.teacherId, "Withdrawal rejected", note || "Your withdrawal request was rejected. Funds remain in your wallet.", "/dashboard/teacher/earnings");
    } else if (action === "paid") {
      if (wd.status !== "approved") throw new ApiError(400, "Approve the withdrawal before marking it paid.");
      if (!payoutRef?.trim()) throw new ApiError(400, "Record the M-Pesa/bank transaction reference before marking paid.");
      const w = wallet(db, wd.teacherId);
      if (w.balance < wd.amount) throw new ApiError(400, "Insufficient wallet balance for this payout.");
      wd.status = "paid"; wd.payoutRef = payoutRef.trim(); wd.decidedBy = actor.id;
      db.walletTxs.unshift({ id: uid("w_"), teacherId: wd.teacherId, type: "withdrawal", amount: -wd.amount, note: `${wd.method === "mpesa" ? "M-Pesa" : "Bank"} payout ${payoutRef}`, createdAt: now() });
      audit(actor.id, "withdrawal.paid", wd.id, payoutRef);
      notify(wd.teacherId, "Payout sent", `KSh ${wd.amount.toLocaleString()} sent. Reference: ${payoutRef}.`, "/dashboard/teacher/earnings");
    } else throw new ApiError(400, "Unknown action.");
    persist();
    return Response.json({ ok: true, withdrawal: wd });
  } catch (e) { return jsonError(e); }
}

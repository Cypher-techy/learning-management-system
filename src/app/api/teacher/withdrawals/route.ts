import { getDB, persist, uid, now, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
import { wallet } from "@/lib/overview";
export async function POST(req: Request) {
  try {
    const user = await requireRole("teacher");
    requireVerified(user);
    const db = getDB();
    const { amount, idempotencyKey } = await req.json();
    if (idempotencyKey && db.withdrawals.some(w => w.idempotencyKey === idempotencyKey))
      return Response.json({ ok: true, duplicate: true });
    if (!user.payoutAccount) throw new ApiError(400, "Add and verify your M-Pesa number or bank account before withdrawing.");
    const amt = Number(amount);
    if (!amt || amt < db.settings.minWithdrawalKES) throw new ApiError(400, `Minimum withdrawal is KSh ${db.settings.minWithdrawalKES.toLocaleString()}.`);
    const w = wallet(db, user.id);
    if (amt > w.available) throw new ApiError(400, `Available balance is KSh ${w.available.toLocaleString()}.`);
    const wd = { id: uid("wd_"), teacherId: user.id, amount: amt, method: user.payoutMethod || "mpesa", account: user.payoutAccount, status: "pending" as const, createdAt: now(), idempotencyKey: idempotencyKey || uid("k_") };
    db.withdrawals.unshift(wd);
    db.users.filter(u => u.role === "administrator" && u.status === "verified").forEach(a =>
      notify(a.id, "Withdrawal request", `${user.fullName} requested KSh ${amt.toLocaleString()} via ${wd.method}.`, "/dashboard/admin/finance"));
    persist();
    return Response.json({ ok: true, withdrawal: wd });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, uid, now, audit, notify, type AccountStatus } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";

/** Verification & status decisions with strict hierarchy:
 *  - administrators: teachers + students only, never themselves, never other administrators
 *  - owner: anyone except the owner account itself */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = getDB();
    const target = db.users.find(u => u.id === id);
    if (!target) throw new ApiError(404, "User not found.");
    if (target.role === "owner") throw new ApiError(403, "This account cannot be modified.");
    if (actor.id === target.id) throw new ApiError(403, "You cannot change your own account status.");
    if (actor.role === "administrator" && target.role === "administrator")
      throw new ApiError(403, "Administrators cannot approve, appoint or modify other administrators.");
    const { status, reason } = await req.json() as { status: AccountStatus; reason?: string };
    if (!["verified", "rejected", "suspended", "disabled", "pending"].includes(status)) throw new ApiError(400, "Invalid status.");
    const from = target.status;
    target.status = status;
    db.verifications.unshift({ id: uid("v_"), userId: target.id, role: target.role, from, to: status, decidedBy: actor.id, reason: reason || "", createdAt: now() });
    audit(actor.id, `user.status.${status}`, target.id, reason);
    notify(target.id, "Account status update", `Your account status is now: ${status}.${reason ? " Reason: " + reason : ""}`);
    persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

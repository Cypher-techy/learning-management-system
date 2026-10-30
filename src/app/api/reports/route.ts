import { getDB, persist, uid, now, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request) {
  try {
    const u = await requireRole("student", "tutor", "administrator", "owner");
    const db = getDB();
    const { targetType, targetId, reason } = await req.json();
    if (!reason?.trim()) throw new ApiError(400, "Tell us why you are reporting this.");
    db.reports.unshift({ id: uid("rep_"), reporterId: u.id, targetType: targetType || "content", targetId: targetId || "", reason, status: "open", createdAt: now() });
    db.users.filter(x => x.role === "administrator" && x.status === "verified").forEach(a => notify(a.id, "Content reported", reason.slice(0, 100), "/dashboard/admin/reports"));
    persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

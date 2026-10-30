import { getDB, persist, audit } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = getDB();
    const r = db.reports.find(x => x.id === id);
    if (!r) throw new ApiError(404, "Report not found.");
    const { status } = await req.json();
    r.status = status === "dismissed" ? "dismissed" : "resolved";
    audit(actor.id, `report.${r.status}`, r.id);
    persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, audit, notify } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = getDB();
    const cert = db.certificates.find(c => c.id === id);
    if (!cert) throw new ApiError(404, "Certificate not found.");
    const { reason } = await req.json();
    cert.revoked = true; cert.revokeReason = reason || "Revoked by administration";
    audit(actor.id, "certificate.revoked", cert.code, cert.revokeReason);
    notify(cert.studentId, "Certificate revoked", `Certificate ${cert.code} was revoked. ${cert.revokeReason}`);
    persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

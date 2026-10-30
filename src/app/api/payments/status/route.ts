import { getDB } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function GET(req: Request) {
  try {
    const user = await requireRole("student");
    const id = new URL(req.url).searchParams.get("id");
    const db = await getDB();
    const p = db.payments.find(x => x.id === id && x.studentId === user.id);
    if (!p) throw new ApiError(404, "Payment not found.");
    return Response.json({ payment: p });
  } catch (e) { return jsonError(e); }
}

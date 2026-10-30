import { getDB, persist, uid, now } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("student");
    const db = await getDB();
    if (!db.enrollments.some(e => e.courseId === id && e.studentId === user.id)) throw new ApiError(400, "Only enrolled students can review a course.");
    const { rating, comment } = await req.json();
    if (!rating || rating < 1 || rating > 5) throw new ApiError(400, "Choose a rating from 1 to 5.");
    const existing = db.reviews.find(r => r.courseId === id && r.studentId === user.id);
    if (existing) { existing.rating = rating; existing.comment = comment || ""; }
    else db.reviews.push({ id: uid("r_"), courseId: id, studentId: user.id, rating, comment: comment || "", createdAt: now() });
    await persist();
    return Response.json({ ok: true });
  } catch (e) { return jsonError(e); }
}

import { getDB, persist, audit } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
export async function PATCH(req: Request) {
  try {
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = await getDB();
    const b = await req.json();
    // Revenue share is owner-only.
    if (b.tutorPercent !== undefined && actor.role !== "owner")
      throw new ApiError(403, "Only the platform owner can change the revenue-sharing percentage.");
    const allowed = ["platformName", "tagline", "premiumPriceKES", "tutorPercent", "minWithdrawalKES", "certificateMinProgress", "certificateMinQuiz", "supportEmail", "supportPhone", "renewReminderDays"];
    for (const k of allowed) if (b[k] !== undefined) (db.settings as any)[k] = b[k];
    if (b.premiumPriceKES !== undefined && db.plans[0]) db.plans[0].priceKES = b.premiumPriceKES;
    audit(actor.id, "settings.updated", "platform", JSON.stringify(Object.keys(b)));
    await persist();
    return Response.json({ ok: true, settings: db.settings });
  } catch (e) { return jsonError(e); }
}

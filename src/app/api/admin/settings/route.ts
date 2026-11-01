import { getDB, persist, audit } from "@/lib/db";
import { jsonError, ApiError, requireRole, requireVerified } from "@/lib/auth";
import { subscriptionPlanRecords } from "@/lib/pricing";

export async function PATCH(req: Request) {
  try {
    const actor = await requireRole("administrator", "owner");
    if (actor.role === "administrator") requireVerified(actor);
    const db = await getDB();
    const b = await req.json();

    // Revenue share is owner-only.
    if (b.tutorPercent !== undefined && actor.role !== "owner")
      throw new ApiError(403, "Only the platform owner can change the revenue-sharing percentage.");

    for (const field of ["premiumMonthlyPriceUSD", "premiumAnnualPriceUSD"] as const) {
      if (b[field] === undefined) continue;
      const value = Number(b[field]);
      if (!Number.isFinite(value) || value <= 0 || value > 100000) {
        throw new ApiError(400, "Premium USD prices must be greater than zero.");
      }
      b[field] = Math.round(value * 100) / 100;
    }
    if (b.tutorPercent !== undefined) {
      const value = Number(b.tutorPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new ApiError(400, "Tutor revenue share must be between 0 and 100.");
      b.tutorPercent = value;
    }

    const allowed = [
      "platformName", "tagline", "premiumMonthlyPriceUSD", "premiumAnnualPriceUSD", "premiumPriceKES",
      "tutorPercent", "minWithdrawalKES", "certificateMinProgress", "certificateMinQuiz",
      "supportEmail", "supportPhone", "renewReminderDays",
    ];
    for (const k of allowed) if (b[k] !== undefined) (db.settings as any)[k] = b[k];
    if (b.premiumMonthlyPriceUSD !== undefined || b.premiumAnnualPriceUSD !== undefined) {
      db.plans = subscriptionPlanRecords(db.settings);
    }

    audit(actor.id, "settings.updated", "platform", JSON.stringify(Object.keys(b)));
    await persist();
    return Response.json({ ok: true, settings: db.settings, plans: db.plans });
  } catch (e) { return jsonError(e); }
}

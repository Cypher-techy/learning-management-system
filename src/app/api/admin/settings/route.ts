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

    // There is no global Premium price anymore. Each premium course is
    // priced independently by its tutor or the super admin before publish.
    if (b.premiumMonthlyPriceUSD !== undefined || b.premiumAnnualPriceUSD !== undefined || b.premiumPriceKES !== undefined) {
      throw new ApiError(400, "All-access subscription prices are no longer sold. Set each premium course's individual price through its course pricing control.");
    }

    if (b.tutorPercent !== undefined) {
      const value = Number(b.tutorPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new ApiError(400, "Tutor revenue share must be between 0 and 100.");
      b.tutorPercent = value;
    }

    const allowed = [
      "platformName", "tagline", "tutorPercent", "minWithdrawalKES",
      "certificateMinProgress", "certificateMinQuiz", "supportEmail",
      "supportPhone", "renewReminderDays",
    ];
    for (const k of allowed) if (b[k] !== undefined) (db.settings as any)[k] = b[k];

    audit(actor.id, "settings.updated", "platform", JSON.stringify(Object.keys(b)));
    await persist();
    return Response.json({ ok: true, settings: db.settings });
  } catch (e) { return jsonError(e); }
}

import { getDB } from "@/lib/db";
import { jsonError, ApiError, requireRole } from "@/lib/auth";
import { quoteSubscription } from "@/lib/fx";
import { isBillingInterval } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** Student-only live checkout quote. This never starts a transaction; the
 *  STK route independently derives and stores the final KES amount. */
export async function GET(req: Request) {
  try {
    await requireRole("student");
    const interval = new URL(req.url).searchParams.get("interval") || "monthly";
    if (!isBillingInterval(interval)) throw new ApiError(400, "Choose a monthly or annual Premium plan.");

    const db = await getDB();
    try {
      const quote = await quoteSubscription(db.settings, interval);
      return Response.json({ quote });
    } catch (error) {
      console.error("Elimu Bora: live USD/KES quote failed.", error);
      throw new ApiError(503, "The live USD/KES exchange rate is temporarily unavailable. Please try again shortly; no payment has been started.");
    }
  } catch (e) { return jsonError(e); }
}

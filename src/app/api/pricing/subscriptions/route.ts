import { getDB } from "@/lib/db";
import { subscriptionPlanOptions } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** Public USD display pricing. The exact KES transaction amount is only
 *  calculated server-side at checkout from the latest USD/KES rate. */
export async function GET() {
  const db = await getDB();
  return Response.json({
    displayCurrency: "USD",
    transactionCurrency: "KES",
    conversion: "Plan prices are displayed in USD. M-Pesa payments are charged in Kenyan shillings using the latest USD/KES reference rate fetched by the server at checkout.",
    plans: subscriptionPlanOptions(db.settings),
  });
}

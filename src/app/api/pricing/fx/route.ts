import { getDB, coursePriceKES, COURSE_PRICE_MIN_KES, COURSE_PRICE_MAX_KES } from "@/lib/db";
import { getLatestUsdKesRate } from "@/lib/fx";

export const dynamic = "force-dynamic";

/** Public latest-rate feed used only to render each course's canonical KES
 *  price in USD. It never changes the M-Pesa transaction amount. */
export async function GET() {
  try {
    const [db, fx] = await Promise.all([getDB(), getLatestUsdKesRate()]);
    const publishedPrices = db.courses
      .filter((c) => c.status === "published" && c.access === "premium")
      .map((c) => coursePriceKES(c));
    const minKES = publishedPrices.length ? Math.min(...publishedPrices) : null;
    const maxKES = publishedPrices.length ? Math.max(...publishedPrices) : null;
    return Response.json({
      displayCurrency: "USD",
      transactionCurrency: "KES",
      fx: {
        rate: fx.rate,
        rateDate: fx.rateDate,
        source: fx.source,
        fetchedAt: fx.fetchedAt,
      },
      coursePriceBandKES: { min: COURSE_PRICE_MIN_KES, max: COURSE_PRICE_MAX_KES },
      publishedPremiumPriceRangeKES: minKES === null ? null : { min: minKES, max: maxKES },
      publishedPremiumPriceRangeUSD: minKES === null || maxKES === null ? null : {
        min: Math.round((minKES / fx.rate) * 10000) / 10000,
        max: Math.round((maxKES / fx.rate) * 10000) / 10000,
      },
    });
  } catch (error) {
    console.error("Elimu Bora: latest USD/KES display rate failed.", error);
    return Response.json(
      { error: "The latest USD/KES exchange rate is temporarily unavailable." },
      { status: 503 },
    );
  }
}

import { sql } from "drizzle-orm";
import { db, schema } from "../db";
import { AppError } from "../errors";

/**
 * Database-backed fixed-window limiter. It works across serverless instances,
 * unlike an in-memory counter. Used for sensitive, unauthenticated or
 * expensive endpoints; authentication endpoints use Better Auth's own limiter.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await db
    .insert(schema.rateLimitHits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimitHits.key,
      set: {
        count: sql`case when ${schema.rateLimitHits.windowStart} = ${windowStart.toISOString()}::timestamptz then ${schema.rateLimitHits.count} + 1 else 1 end`,
        windowStart,
      },
    })
    .returning({ count: schema.rateLimitHits.count });
  if (row && row.count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
  }
}

import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { getPaymentStatus } from "@/server/payments/providers";
import { isEmailConfigured } from "@/server/services/email";
import { storageStatus } from "@/server/services/storage";

function authorized(request: Request) {
  const token = env().HEALTHCHECK_TOKEN;
  if (!token) return false;
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Liveness and readiness probe. Anonymous callers learn only whether the
 * service is healthy; component detail requires HEALTHCHECK_TOKEN.
 */
export async function GET(request: Request) {
  const started = Date.now();
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch (error) {
    console.error("[health] database check failed", error);
  }
  const body: Record<string, unknown> = { status: database ? "ok" : "degraded" };
  if (authorized(request)) {
    const payments = getPaymentStatus();
    body.checks = {
      database: { ok: database, latencyMs: Date.now() - started },
      storage: storageStatus(),
      email: { configured: isEmailConfigured() },
      payments: payments.enabled ? { enabled: true, provider: payments.provider.id } : { enabled: false },
    };
  }
  return Response.json(body, { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

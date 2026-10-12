import "server-only";
import { env } from "@/lib/env";
import { AppError, statusForError } from "./errors";

/** Converts a thrown error into a JSON response without leaking internals. */
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: statusForError(error.code), headers: { "Cache-Control": "no-store" } });
  }
  console.error("[http] unexpected error", error);
  return Response.json({ error: "Something went wrong." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

/**
 * Rejects state-changing requests that did not originate from this site.
 * Session cookies are SameSite=Lax already; this is defence in depth for
 * route handlers, which are not covered by the framework's action checks.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new URL(env().NEXT_PUBLIC_APP_URL).origin;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const sameHost = !!origin && !!host && new URL(origin).host === host;
  if (!origin || (origin !== allowed && !sameHost)) {
    throw new AppError("FORBIDDEN", "Cross-site request refused.");
  }
}

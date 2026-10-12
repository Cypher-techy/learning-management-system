import { handlePaymentCallback } from "@/server/services/payments";

/**
 * Payment provider webhook. The request is authenticated inside
 * `handlePaymentCallback` (secret path token and/or signature, then a
 * server-to-server confirmation) before any enrollment is activated.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; token: string }> },
) {
  const { provider, token } = await params;
  try {
    const rawBody = (await request.text()).slice(0, 100_000);
    const result = await handlePaymentCallback(provider, { token, headers: request.headers, rawBody });
    if (result === null) {
      // Not authentic: reveal nothing about what exists here.
      return new Response("Not found", { status: 404 });
    }
    // Daraja expects this acknowledgement shape; it is harmless for others.
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("[payments] callback handling failed", error);
    // A non-2xx response asks the provider to retry later.
    return new Response("Temporary failure", { status: 503 });
  }
}

import "server-only";
import { clientIp } from "../auth/session";
import { AppError } from "../errors";
import { verifyCertificate, type VerificationResult } from "../services/certificates";
import { rateLimit } from "../services/ratelimit";

/** Rate-limited public lookup, so certificate numbers cannot be enumerated. */
export async function lookupCertificate(number: string | undefined) {
  if (!number || number.trim() === "") return { result: null as VerificationResult | null, limited: false };
  try {
    await rateLimit(`verify:${(await clientIp()) ?? "unknown"}`, 20, 60);
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") return { result: null, limited: true };
    throw error;
  }
  return { result: await verifyCertificate(number), limited: false };
}

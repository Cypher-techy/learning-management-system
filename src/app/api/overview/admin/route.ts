import { getDB } from "@/lib/db";
import { jsonError, requireRole, requireVerified } from "@/lib/auth";
import { adminData } from "@/lib/overview";
export async function GET() { try { const u = await requireRole("administrator"); requireVerified(u); return Response.json(adminData(await getDB(), u)); } catch (e) { return jsonError(e); } }

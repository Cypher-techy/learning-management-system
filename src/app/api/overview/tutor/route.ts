import { getDB } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";
import { tutorData } from "@/lib/overview";
export async function GET() { try { const u = await requireRole("tutor"); return Response.json(tutorData(await getDB(), u)); } catch (e) { return jsonError(e); } }

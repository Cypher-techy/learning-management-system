import { getDB } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";
import { teacherData } from "@/lib/overview";
export async function GET() { try { const u = await requireRole("teacher"); return Response.json(teacherData(getDB(), u)); } catch (e) { return jsonError(e); } }

import { getDB } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";
import { studentData } from "@/lib/overview";
export async function GET() { try { const u = await requireRole("student"); return Response.json(studentData(getDB(), u)); } catch (e) { return jsonError(e); } }

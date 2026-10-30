import { getDB, publicUser } from "@/lib/db";
import { jsonError, requireRole } from "@/lib/auth";
import { adminData, wallet, nameOf } from "@/lib/overview";
export async function GET() {
  try {
    const u = await requireRole("owner");
    const db = getDB();
    const base = adminData(db, u);
    return Response.json({
      ...base, user: publicUser(u),
      administrators: db.users.filter(x => x.role === "administrator").map(x => publicUser(x)),
      tutorWallets: db.users.filter(x => x.role === "tutor").map(t => ({ tutorId: t.id, tutorName: t.fullName, status: t.status, ...wallet(db, t.id) })),
      allAudit: db.auditLogs.slice(0, 100).map(a => ({ ...a, actorName: nameOf(db, a.actorId) })),
      integrations: {
        mpesaConfigured: !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_SHORTCODE),
        supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        mailConfigured: !!process.env.RESEND_API_KEY,
        aiConfigured: !!process.env.OPENAI_API_KEY,
      },
    });
  } catch (e) { return jsonError(e); }
}

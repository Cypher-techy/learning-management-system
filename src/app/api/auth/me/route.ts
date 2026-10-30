import { currentUser } from "@/lib/auth";
import { getDB, publicUser, isPremiumActive } from "@/lib/db";
export async function GET() {
  const u = await currentUser();
  if (!u) return Response.json({ user: null });
  const db = getDB();
  return Response.json({ user: { ...publicUser(u), premiumActive: isPremiumActive(db, u) } });
}

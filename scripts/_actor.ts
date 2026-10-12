import { eq } from "drizzle-orm";
import { db, schema } from "../src/server/db";
import { isRole, resolvePermissions, type Actor } from "../src/server/permissions";

/** Builds the actor for a user id exactly as a web request would, for use in scripts. */
export async function actorFromUser(userId: string): Promise<Actor> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) throw new Error(`User ${userId} not found.`);
  const role = isRole(user.role) ? user.role : "student";
  const overrides = await db.select().from(schema.rolePermissions);
  return { id: user.id, name: user.name, email: user.email, role, permissions: resolvePermissions(role, overrides) };
}

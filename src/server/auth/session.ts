import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "../db";
import {
  homeForRole,
  isRole,
  resolvePermissions,
  type Actor,
  type Permission,
  type Role,
} from "../permissions";
import { getAuth } from "./auth";

/**
 * The signed-in user for this request, or null. Memoised per request.
 * Role, suspension status and permissions are always read from the database,
 * never from anything the browser sends.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = session.user as typeof session.user & { role?: string | null; banned?: boolean | null };
  if (user.banned) return null;
  const role: Role = isRole(user.role) ? user.role : "student";
  const overrides = role === "admin" ? [] : await db.select().from(schema.rolePermissions);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    permissions: resolvePermissions(role, overrides),
  };
});

/** For pages: redirects to sign-in when there is no session. */
export async function requireActor(returnTo?: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) {
    redirect(returnTo ? `/sign-in?next=${encodeURIComponent(returnTo)}` : "/sign-in");
  }
  return actor;
}

/** For pages: only the listed roles may continue; others go to their own home. */
export async function requireRole(...roles: Role[]): Promise<Actor> {
  const actor = await requireActor();
  if (!roles.includes(actor.role)) redirect(homeForRole(actor.role));
  return actor;
}

/** For pages: requires a specific permission. */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.permissions.has(permission)) redirect(homeForRole(actor.role));
  return actor;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

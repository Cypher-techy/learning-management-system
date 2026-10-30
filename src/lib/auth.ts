import crypto from "crypto";
import { cookies } from "next/headers";
import { getDB, sessionSecret, type User, type Role } from "./db";

const COOKIE = "edvora_session";
interface Payload { uid: string; role: Role; exp: number }

function sign(payload: Payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyToken(token: string | undefined): Payload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export async function setSession(user: User) {
  await getDB(); // ensure the persisted fallback session seed is loaded before signing
  const token = sign({ uid: user.id, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 7 });
}
export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
/** Server-side session resolution — role is ALWAYS read from the DB, never trusted from the client. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const db = await getDB(); // load first: token verification may need the persisted session seed
  const payload = verifyToken(jar.get(COOKIE)?.value);
  if (!payload) return null;
  const user = db.users.find((u) => u.id === payload.uid);
  if (!user || user.status === "disabled" || user.status === "suspended") return null;
  return user;
}
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.");
  if (!roles.includes(user.role)) throw new ApiError(403, "You do not have permission to access this resource.");
  return user;
}
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function jsonError(e: unknown) {
  if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
export function requireVerified(user: User) {
  if (user.role === "tutor" && user.status !== "verified") throw new ApiError(403, "Your tutor application is still pending verification.");
  if (user.role === "administrator" && user.status !== "verified") throw new ApiError(403, "Your administrator access has not been approved yet.");
}

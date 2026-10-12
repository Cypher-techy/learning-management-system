import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { E2E_BASE_URL, E2E_DATABASE_URL, e2eEnv } from "../../playwright.config";

/** Runs a project script with tsx in a single child process. */
function run(script: string) {
  const tsx = path.resolve("node_modules/tsx/dist/cli.mjs");
  const env = { ...process.env, ...e2eEnv, NODE_ENV: "development" };
  execFileSync(process.execPath, [tsx, script], { env, stdio: ["ignore", "inherit", "inherit"] });
}

/**
 * Rebuilds the disposable end-to-end database: wipe, migrate, seed.
 * This is destructive by design, so it only ever touches a database whose
 * name ends in "_e2e".
 */
export default async function globalSetup() {
  const name = new URL(E2E_DATABASE_URL).pathname.slice(1);
  if (!name.endsWith("_e2e")) {
    throw new Error(`Refusing to reset "${name}": the end-to-end database name must end in "_e2e".`);
  }
  const sql = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  } finally {
    await sql.end();
  }
  rmSync(".storage-e2e", { recursive: true, force: true });
  run("scripts/migrate.ts");
  run("scripts/seed.ts");
  await warmUp();
}

/**
 * The development server compiles each route the first time it is requested,
 * which can take many seconds. Requesting the main routes once up front keeps
 * that cost out of the individual tests.
 */
async function warmUp() {
  const routes = [
    "/", "/courses", "/courses/demo-getting-started", "/sign-in", "/register", "/forgot-password", "/reset-password",
    "/verify", "/api/auth/get-session", "/dashboard", "/learn", "/learn/courses", "/learn/certificates",
    "/learn/courses/demo-getting-started", "/instructor", "/instructor/courses", "/admin", "/admin/users",
    "/admin/certificates", "/admin/settings", "/account", "/this-page-does-not-exist",
  ];
  for (const route of routes) {
    try {
      await fetch(`${E2E_BASE_URL}${route}`, { redirect: "manual", signal: AbortSignal.timeout(180_000) });
    } catch {
      // Warm-up is best effort; the tests report real failures.
    }
  }
}

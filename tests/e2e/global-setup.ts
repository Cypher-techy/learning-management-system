import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { E2E_DATABASE_URL, e2eEnv } from "../../playwright.config";

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
}

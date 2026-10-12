/**
 * Every test file gets its own in-process PostgreSQL (PGlite) with the real
 * migrations applied. Nothing here can reach a development or production
 * database: DATABASE_URL is cleared before the application code loads.
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll } from "vitest";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
  STORAGE_DRIVER: "local",
  PAYMENT_PROVIDER: "disabled",
  SMTP_HOST: "",
});

let client: PGlite | undefined;

beforeAll(async () => {
  const { schema, setDb } = await import("@/server/db");
  const { setStorage } = await import("@/server/services/storage");
  client = new PGlite();
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
  setDb(database as never);

  const memory = new Map<string, Buffer>();
  setStorage({
    kind: "local",
    put: async (key, body) => void memory.set(key, body),
    delete: async (key) => void memory.delete(key),
  });
});

afterAll(async () => {
  await client?.close();
});

import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };

type Schema = typeof schema;

/** Driver-agnostic database type, so tests can supply an in-process Postgres. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Either the root database or an open transaction. */
export type DbOrTx = Db | Tx;

const globalStore = globalThis as unknown as {
  __lmsDb?: Db;
  __lmsSql?: ReturnType<typeof postgres>;
};

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. See .env.example.");
  }
  const sql = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    // Fail quickly with a clear error when the database is unreachable,
    // rather than leaving a page hanging for the driver's 30-second default.
    connect_timeout: 10,
    // Required by transaction-mode poolers (e.g. PgBouncer, Supavisor).
    prepare: process.env.DATABASE_DISABLE_PREPARE === "true" ? false : true,
    onnotice: () => {},
  });
  globalStore.__lmsSql = sql;
  return drizzle(sql, { schema }) as unknown as Db;
}

export function getDb(): Db {
  if (!globalStore.__lmsDb) globalStore.__lmsDb = connect();
  return globalStore.__lmsDb;
}

/** Test hook: swap in another database instance. */
export function setDb(instance: Db) {
  globalStore.__lmsDb = instance;
}

/**
 * Lazily-connected database handle. Importing this module never opens a
 * connection, which keeps `next build` independent of database availability.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

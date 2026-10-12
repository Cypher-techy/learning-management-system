/**
 * Applies pending database migrations.
 *
 *   npm run db:migrate
 *
 * Migrations are forward-only and are never generated or reset automatically.
 * This script only ever runs the SQL files committed in ./drizzle.
 */
import "./_env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. See .env.example.");
    process.exit(1);
  }
  const target = new URL(url);
  console.log(`Migrating ${target.hostname}:${target.port || 5432}${target.pathname} ...`);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("Migrations are up to date.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});

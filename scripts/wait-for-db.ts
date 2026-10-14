/**
 * Runs before `npm run dev`. Waits for the database to accept connections so
 * the first page does not hang and then fail with a connection timeout.
 *
 * If the database never answers, it stops with instructions instead of
 * starting a server that can only show errors.
 */
import "./_env";
import postgres from "postgres";

const WAIT_SECONDS = 60;

async function attempt(url: string): Promise<string | null> {
  const sql = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await sql`select 1`;
    return null;
  } catch (error) {
    return (error as { code?: string; message?: string }).code ?? (error as Error).message;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("\nDATABASE_URL is not set. Copy .env.example to .env.local first.\n");
    process.exit(1);
  }
  const target = new URL(url);
  const where = `${target.hostname}:${target.port || 5432}`;
  const deadline = Date.now() + WAIT_SECONDS * 1000;
  let reason: string | null = null;
  let announced = false;

  while (Date.now() < deadline) {
    reason = await attempt(url);
    if (reason === null) {
      if (announced) console.log("Database is ready.");
      return;
    }
    if (!announced) {
      console.log(`Waiting for the database at ${where} (up to ${WAIT_SECONDS} seconds) ...`);
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const local = target.hostname === "127.0.0.1" || target.hostname === "localhost";
  console.error(`
The database at ${where} did not respond (${reason}).
${
  local
    ? `
This is the local development database, which runs in Docker.

  1. Open Docker Desktop and wait until it says it is running.
  2. Start the database:      npm run db:up
  3. Start the app again:     npm run dev

If Docker is running but the database is still slow to answer, the computer
is probably short of memory. Close other applications, or stop containers
that belong to other projects.
`
    : `
Check that DATABASE_URL in .env.local is correct and that the database
accepts connections from this machine.
`
}`);
  process.exit(1);
}

main();

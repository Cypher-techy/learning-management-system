/**
 * Provisions an administrator account. This is the documented way to create
 * the first administrator: public registration can never grant the role.
 *
 *   npm run admin:create -- --email you@example.com --name "Your Name"
 *
 * The password is read from the ADMIN_PASSWORD environment variable or, if it
 * is not set, prompted for without echoing. It is never taken from a command
 * line argument, so it does not end up in shell history or process lists.
 */
import "./_env";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { eq } from "drizzle-orm";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    const output = stdout as NodeJS.WriteStream & { _mute?: boolean };
    const write = output.write.bind(output);
    stdout.write(question);
    (output as unknown as { write: (chunk: string) => boolean }).write = () => true;
    rl.question("", (answer) => {
      (output as unknown as { write: typeof write }).write = write;
      stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg("email");
  const name = arg("name");
  if (!email || !name) {
    console.error('Usage: npm run admin:create -- --email you@example.com --name "Your Name"');
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password (at least 10 characters): "));

  const { db, schema } = await import("../src/server/db");
  const { provisionAccount } = await import("../src/server/services/admin");
  const { logAudit } = await import("../src/server/services/audit");

  const normalized = email.trim().toLowerCase();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, normalized));
  if (existing) {
    if (existing.role === "admin") {
      console.log(`${normalized} is already an administrator. Nothing changed.`);
      return;
    }
    if (!process.argv.includes("--promote")) {
      console.error(`${normalized} already has an account (role: ${existing.role}). Re-run with --promote to make it an administrator.`);
      process.exit(1);
    }
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing.id));
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, existing.id));
      await logAudit(tx, { actorId: null, action: "user.promote_admin_cli", entityType: "user", entityId: existing.id });
    });
    console.log(`Promoted ${normalized} to administrator. Existing sessions were signed out.`);
    return;
  }

  const user = await db.transaction(async (tx) => {
    const created = await provisionAccount(tx, { name, email: normalized, password, role: "admin" });
    await logAudit(tx, { actorId: null, action: "user.create_admin_cli", entityType: "user", entityId: created.id });
    return created;
  });
  console.log(`Administrator created: ${user.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });

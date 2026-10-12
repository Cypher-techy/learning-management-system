import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { db, schema, type DbOrTx, type Tx } from "../db";
import { assertSignedIn, type Actor } from "../permissions";
import { sendEmail } from "./email";
import { getSettings } from "./settings";

export const NOTIFICATION_CATEGORIES = {
  enrollment: "Course enrollment",
  course_update: "New lessons and announcements",
  assessment: "Examinations and deadlines",
  submission: "Submission confirmations",
  grade: "Grades and feedback",
  certificate: "Course completion and certificates",
  security: "Account security",
} as const;

export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

/** Security notices are always delivered. */
export const LOCKED_CATEGORIES: NotificationCategory[] = ["security"];

export type NotificationInput = {
  userIds: string[];
  category: NotificationCategory;
  title: string;
  body?: string;
  /** App-relative link, e.g. "/learn/grades". */
  link?: string;
};

type PendingEmail = { to: string; subject: string; text: string; link?: string };

export type Notify = (input: NotificationInput) => Promise<void>;

async function createNotifications(conn: DbOrTx, input: NotificationInput): Promise<PendingEmail[]> {
  const ids = [...new Set(input.userIds)];
  if (ids.length === 0) return [];
  const recipients = await conn
    .select({
      id: schema.users.id,
      email: schema.users.email,
      banned: schema.users.banned,
      prefs: schema.profiles.notificationPrefs,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(inArray(schema.users.id, ids));

  const locked = LOCKED_CATEGORIES.includes(input.category);
  const inApp = recipients.filter(
    (r) => locked || !(r.prefs?.inAppOff ?? []).includes(input.category),
  );
  if (inApp.length > 0) {
    await conn.insert(schema.notifications).values(
      inApp.map((r) => ({
        userId: r.id,
        category: input.category,
        title: input.title,
        body: input.body ?? "",
        link: input.link ?? null,
      })),
    );
  }
  return recipients
    .filter((r) => !r.banned && (locked || !(r.prefs?.emailOff ?? []).includes(input.category)))
    .map((r) => ({ to: r.email, subject: input.title, text: input.body ?? input.title, link: input.link }));
}

async function deliver(pending: PendingEmail[]) {
  if (pending.length === 0) return;
  try {
    const settings = await getSettings();
    if (!settings.emailNotificationsEnabled) return;
    const base = env().NEXT_PUBLIC_APP_URL;
    await Promise.allSettled(
      pending.map((p) =>
        sendEmail({
          to: p.to,
          subject: `${p.subject} - ${settings.platformName}`,
          text: p.text,
          action: p.link ? { label: "Open", url: `${base}${p.link}` } : undefined,
        }),
      ),
    );
  } catch (error) {
    console.error("[notifications] email delivery failed", error);
  }
}

/**
 * Runs `fn` in a transaction. In-app notifications are written inside the
 * transaction; the matching emails are sent only after it commits, so a
 * rollback never produces a misleading email and SMTP latency never holds a
 * database transaction open.
 */
export async function withNotifications<T>(fn: (tx: Tx, notify: Notify) => Promise<T>): Promise<T> {
  const pending: PendingEmail[] = [];
  const result = await db.transaction(async (tx) => {
    const notify: Notify = async (input) => {
      pending.push(...(await createNotifications(tx, input)));
    };
    return fn(tx, notify);
  });
  await deliver(pending);
  return result;
}

/** One-off notification outside a larger transaction. */
export async function notifyNow(input: NotificationInput) {
  const pending = await createNotifications(db, input);
  await deliver(pending);
}

// --- Reading ---------------------------------------------------------------

export async function listNotifications(actor: Actor, page = 1, pageSize = 20) {
  assertSignedIn(actor);
  const where = eq(schema.notifications.userId, actor.id);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(schema.notifications)
      .where(where)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(schema.notifications).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return row?.n ?? 0;
}

export async function markRead(actor: Actor, notificationId: string) {
  assertSignedIn(actor);
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, actor.id),
        isNull(schema.notifications.readAt),
      ),
    );
}

export async function markAllRead(actor: Actor) {
  assertSignedIn(actor);
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notifications.userId, actor.id), isNull(schema.notifications.readAt)));
}

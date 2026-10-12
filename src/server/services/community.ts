import { and, asc, count, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, can, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { assertCanManageCourse, canManageCourse } from "./courses";
import { withNotifications } from "./notifications";
import { LEARNER_VISIBLE_COURSE_STATUSES } from "./progress";
import { rateLimit } from "./ratelimit";

const {
  discussions,
  discussionReplies,
  contentReports,
  announcements,
  liveSessions,
  supportRequests,
  courses,
  enrollments,
  users,
} = schema;

// ===========================================================================
// Discussions
// ===========================================================================

export type DiscussionRole = "learner" | "moderator";

/** Only enrolled learners and the course's own staff may read or post. */
export async function discussionRole(actor: Actor, courseId: string, conn: DbOrTx = db): Promise<DiscussionRole> {
  assertSignedIn(actor);
  if (can(actor, "support.manage")) return "moderator";
  if (can(actor, "discussion.moderate") && (await canManageCourse(actor, courseId))) return "moderator";
  const [row] = await conn
    .select({ status: enrollments.status, courseStatus: courses.status })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(enrollments.userId, actor.id), eq(enrollments.courseId, courseId)));
  const ok =
    row &&
    (row.status === "active" || row.status === "completed") &&
    (LEARNER_VISIBLE_COURSE_STATUSES as readonly string[]).includes(row.courseStatus);
  if (!ok) throw forbidden("Only enrolled learners can take part in this course's discussions.");
  return "learner";
}

export const discussionSchema = z.object({
  title: z.string().trim().min(5, "Add a title of at least 5 characters.").max(160),
  body: z.string().trim().min(10, "Write at least 10 characters.").max(10000),
});

export async function createDiscussion(actor: Actor, courseId: string, input: z.infer<typeof discussionSchema>) {
  const data = discussionSchema.parse(input);
  await discussionRole(actor, courseId);
  await rateLimit(`discussion:${actor.id}`, 10, 600);
  const [row] = await db.insert(discussions).values({ ...data, courseId, authorId: actor.id }).returning();
  return row!;
}

async function loadDiscussion(conn: DbOrTx, discussionId: string) {
  const [row] = await conn.select().from(discussions).where(eq(discussions.id, discussionId));
  if (!row) throw notFound("The discussion");
  return row;
}

export async function replyToDiscussion(actor: Actor, discussionId: string, body: string) {
  const text = z.string().trim().min(2, "Write a reply first.").max(10000).parse(body);
  const discussion = await loadDiscussion(db, discussionId);
  const role = await discussionRole(actor, discussion.courseId);
  if (discussion.isHidden && role !== "moderator") throw notFound("The discussion");
  if (discussion.isLocked && role !== "moderator") throw conflict("This discussion is locked.");
  await rateLimit(`reply:${actor.id}`, 30, 600);
  await withNotifications(async (tx, notify) => {
    await tx.insert(discussionReplies).values({ discussionId, authorId: actor.id, body: text });
    if (discussion.authorId !== actor.id) {
      await notify({
        userIds: [discussion.authorId],
        category: "course_update",
        title: `New reply: ${discussion.title}`,
        link: `/discussions/${discussionId}`,
      });
    }
  });
  return discussion;
}

export async function listDiscussions(actor: Actor, courseId: string) {
  const role = await discussionRole(actor, courseId);
  const rows = await db
    .select({
      id: discussions.id,
      title: discussions.title,
      isPinned: discussions.isPinned,
      isLocked: discussions.isLocked,
      isHidden: discussions.isHidden,
      createdAt: discussions.createdAt,
      authorName: users.name,
      replyCount: sql<number>`(select count(*)::int from ${discussionReplies} where ${discussionReplies.discussionId} = ${discussions.id} and not ${discussionReplies.isHidden})`,
    })
    .from(discussions)
    .innerJoin(users, eq(users.id, discussions.authorId))
    .where(role === "moderator" ? eq(discussions.courseId, courseId) : and(eq(discussions.courseId, courseId), eq(discussions.isHidden, false)))
    .orderBy(desc(discussions.isPinned), desc(discussions.createdAt))
    .limit(200);
  return { role, rows };
}

/** Authors are shown by name only; email addresses are never included. */
export async function getDiscussion(actor: Actor, discussionId: string) {
  const discussion = await loadDiscussion(db, discussionId);
  const role = await discussionRole(actor, discussion.courseId);
  if (discussion.isHidden && role !== "moderator") throw notFound("The discussion");
  const [[author], [course], replies] = await Promise.all([
    db.select({ name: users.name, role: users.role }).from(users).where(eq(users.id, discussion.authorId)),
    db.select({ id: courses.id, title: courses.title, slug: courses.slug }).from(courses).where(eq(courses.id, discussion.courseId)),
    db
      .select({
        id: discussionReplies.id,
        body: discussionReplies.body,
        isHidden: discussionReplies.isHidden,
        createdAt: discussionReplies.createdAt,
        authorId: discussionReplies.authorId,
        authorName: users.name,
        authorRole: users.role,
      })
      .from(discussionReplies)
      .innerJoin(users, eq(users.id, discussionReplies.authorId))
      .where(
        role === "moderator"
          ? eq(discussionReplies.discussionId, discussionId)
          : and(eq(discussionReplies.discussionId, discussionId), eq(discussionReplies.isHidden, false)),
      )
      .orderBy(asc(discussionReplies.createdAt)),
  ]);
  return { discussion, author: author!, course: course!, replies, role };
}

export async function moderateDiscussion(
  actor: Actor,
  discussionId: string,
  action: "pin" | "unpin" | "lock" | "unlock" | "hide" | "unhide",
) {
  const discussion = await loadDiscussion(db, discussionId);
  if ((await discussionRole(actor, discussion.courseId)) !== "moderator") throw forbidden();
  const patch = {
    pin: { isPinned: true },
    unpin: { isPinned: false },
    lock: { isLocked: true },
    unlock: { isLocked: false },
    hide: { isHidden: true },
    unhide: { isHidden: false },
  }[action];
  await db.update(discussions).set(patch).where(eq(discussions.id, discussionId));
  await logAudit(db, { actorId: actor.id, action: `discussion.${action}`, entityType: "discussion", entityId: discussionId });
  return discussion;
}

export async function moderateReply(actor: Actor, replyId: string, hidden: boolean) {
  const [reply] = await db.select().from(discussionReplies).where(eq(discussionReplies.id, replyId));
  if (!reply) throw notFound("The reply");
  const discussion = await loadDiscussion(db, reply.discussionId);
  if ((await discussionRole(actor, discussion.courseId)) !== "moderator") throw forbidden();
  await db.update(discussionReplies).set({ isHidden: hidden }).where(eq(discussionReplies.id, replyId));
  await logAudit(db, {
    actorId: actor.id,
    action: hidden ? "reply.hide" : "reply.unhide",
    entityType: "discussion_reply",
    entityId: replyId,
  });
  return discussion;
}

export async function reportContent(
  actor: Actor,
  target: { discussionId?: string; replyId?: string },
  reason: string,
) {
  const text = z.string().trim().min(5, "Describe the problem briefly.").max(1000).parse(reason);
  let discussionId = target.discussionId ?? null;
  if (target.replyId) {
    const [reply] = await db.select().from(discussionReplies).where(eq(discussionReplies.id, target.replyId));
    if (!reply) throw notFound("The reply");
    discussionId = reply.discussionId;
  }
  if (!discussionId) throw invalid("Nothing was selected to report.");
  const discussion = await loadDiscussion(db, discussionId);
  await discussionRole(actor, discussion.courseId);
  await rateLimit(`report:${actor.id}`, 10, 3600);
  await db.insert(contentReports).values({
    reporterId: actor.id,
    discussionId: target.replyId ? null : discussionId,
    replyId: target.replyId ?? null,
    reason: text,
  });
  return discussion;
}

export async function resolveReport(actor: Actor, reportId: string, action: "hide_content" | "dismiss") {
  assertCan(actor, "support.manage");
  await db.transaction(async (tx) => {
    const [report] = await tx.select().from(contentReports).where(eq(contentReports.id, reportId));
    if (!report) throw notFound("The report");
    if (action === "hide_content") {
      if (report.replyId) {
        await tx.update(discussionReplies).set({ isHidden: true }).where(eq(discussionReplies.id, report.replyId));
      } else if (report.discussionId) {
        await tx.update(discussions).set({ isHidden: true }).where(eq(discussions.id, report.discussionId));
      }
    }
    await tx
      .update(contentReports)
      .set({ status: action === "dismiss" ? "dismissed" : "resolved", resolvedBy: actor.id, resolvedAt: new Date() })
      .where(eq(contentReports.id, reportId));
    await logAudit(tx, { actorId: actor.id, action: `report.${action}`, entityType: "content_report", entityId: reportId });
  });
}

// ===========================================================================
// Announcements
// ===========================================================================

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(5).max(10000),
});

export async function createCourseAnnouncement(actor: Actor, courseId: string, input: z.infer<typeof announcementSchema>) {
  assertCan(actor, "announcement.course");
  const data = announcementSchema.parse(input);
  await withNotifications(async (tx, notify) => {
    const course = await assertCanManageCourse(actor, courseId, tx);
    await tx.insert(announcements).values({ ...data, courseId, authorId: actor.id });
    const learners = await tx
      .select({ id: enrollments.userId })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), inArray(enrollments.status, ["active", "completed"])));
    await notify({
      userIds: learners.map((l) => l.id),
      category: "course_update",
      title: `${course.title}: ${data.title}`,
      body: data.body.slice(0, 500),
      link: `/learn/courses/${course.slug}`,
    });
  });
}

export async function createPlatformAnnouncement(actor: Actor, input: z.infer<typeof announcementSchema>) {
  assertCan(actor, "announcement.platform");
  const data = announcementSchema.parse(input);
  await withNotifications(async (tx, notify) => {
    await tx.insert(announcements).values({ ...data, courseId: null, authorId: actor.id });
    const everyone = await tx.select({ id: users.id }).from(users).where(eq(users.banned, false));
    await notify({
      userIds: everyone.map((u) => u.id),
      category: "course_update",
      title: data.title,
      body: data.body.slice(0, 500),
      link: "/notifications",
    });
    await logAudit(tx, { actorId: actor.id, action: "announcement.platform", entityType: "announcement" });
  });
}

export async function deleteAnnouncement(actor: Actor, announcementId: string) {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, announcementId));
  if (!row) throw notFound("The announcement");
  if (row.courseId) {
    assertCan(actor, "announcement.course");
    await assertCanManageCourse(actor, row.courseId);
  } else {
    assertCan(actor, "announcement.platform");
  }
  await db.delete(announcements).where(eq(announcements.id, announcementId));
  return row;
}

/** Platform-wide announcements plus those of the learner's own courses. */
export async function announcementsForLearner(userId: string, limit = 5) {
  const mine = db
    .select({ id: enrollments.courseId })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), inArray(enrollments.status, ["active", "completed"])));
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      createdAt: announcements.createdAt,
      courseTitle: courses.title,
    })
    .from(announcements)
    .leftJoin(courses, eq(courses.id, announcements.courseId))
    .where(or(isNull(announcements.courseId), inArray(announcements.courseId, mine)))
    .orderBy(desc(announcements.createdAt))
    .limit(limit);
}

// ===========================================================================
// Live sessions (link-based)
// ===========================================================================

export const liveSessionSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).default(""),
  provider: z.enum(schema.liveProvider.enumValues),
  joinUrl: z.string().trim().max(500).regex(/^https:\/\/[^\s]+$/i, "Enter the full https:// meeting link."),
  startsAt: z.date(),
  durationMinutes: z.number().int().min(5).max(720),
});

export async function createLiveSession(actor: Actor, courseId: string, input: z.infer<typeof liveSessionSchema>) {
  assertCan(actor, "live_session.manage");
  const data = liveSessionSchema.parse(input);
  await withNotifications(async (tx, notify) => {
    const course = await assertCanManageCourse(actor, courseId, tx);
    await tx.insert(liveSessions).values({ ...data, courseId, createdBy: actor.id });
    const learners = await tx
      .select({ id: enrollments.userId })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, courseId), eq(enrollments.status, "active")));
    await notify({
      userIds: learners.map((l) => l.id),
      category: "course_update",
      title: `Live session scheduled: ${data.title}`,
      body: `${course.title} - ${data.startsAt.toUTCString()}`,
      link: "/learn/calendar",
    });
  });
}

export async function deleteLiveSession(actor: Actor, sessionId: string) {
  assertCan(actor, "live_session.manage");
  const [row] = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
  if (!row) throw notFound("The live session");
  await assertCanManageCourse(actor, row.courseId);
  await db.delete(liveSessions).where(eq(liveSessions.id, sessionId));
  return row;
}

/** Join links are returned only for courses the learner is enrolled in. */
export async function upcomingLiveSessions(userId: string, limit = 20) {
  const mine = db
    .select({ id: enrollments.courseId })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), inArray(enrollments.status, ["active", "completed"])));
  return db
    .select({ session: liveSessions, courseTitle: courses.title, courseSlug: courses.slug })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(and(inArray(liveSessions.courseId, mine), gte(liveSessions.startsAt, new Date(Date.now() - 2 * 3600_000))))
    .orderBy(asc(liveSessions.startsAt))
    .limit(limit);
}

// ===========================================================================
// Support
// ===========================================================================

export const supportSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10, "Describe how we can help (at least 10 characters).").max(5000),
});

export async function createSupportRequest(actor: Actor | null, ip: string | null, input: z.infer<typeof supportSchema>) {
  const data = supportSchema.parse(input);
  await rateLimit(`support:${actor?.id ?? ip ?? "anonymous"}`, 5, 3600);
  await db.insert(supportRequests).values({ ...data, userId: actor?.id ?? null });
}

export async function updateSupportRequest(
  actor: Actor,
  requestId: string,
  input: { status: (typeof schema.supportStatus.enumValues)[number]; adminNote: string },
) {
  assertCan(actor, "support.manage");
  const [row] = await db.select({ id: supportRequests.id }).from(supportRequests).where(eq(supportRequests.id, requestId));
  if (!row) throw notFound("The support request");
  await db
    .update(supportRequests)
    .set({ status: input.status, adminNote: input.adminNote.trim().slice(0, 5000) || null, handledBy: actor.id })
    .where(eq(supportRequests.id, requestId));
  await logAudit(db, {
    actorId: actor.id,
    action: "support.update",
    entityType: "support_request",
    entityId: requestId,
    metadata: { status: input.status },
  });
}

export async function openSupportCount() {
  const [row] = await db.select({ n: count() }).from(supportRequests).where(eq(supportRequests.status, "open"));
  return row?.n ?? 0;
}

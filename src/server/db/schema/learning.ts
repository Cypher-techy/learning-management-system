import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./catalog";
import { createdAt, id, ts, updatedAt } from "./_shared";

export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "completed",
  "suspended",
  "cancelled",
]);

export const enrollmentSource = pgEnum("enrollment_source", [
  "free",
  "purchase",
  "admin_grant",
]);

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    status: enrollmentStatus("status").notNull().default("active"),
    source: enrollmentSource("source").notNull(),
    /** Cached value, always recomputed on the server from lesson_progress. */
    progressPercent: integer("progress_percent").notNull().default(0),
    lastLessonId: uuid("last_lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    lastAccessedAt: ts("last_accessed_at"),
    completedAt: ts("completed_at"),
    enrolledAt: ts("enrolled_at").notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("enrollments_user_course_idx").on(t.userId, t.courseId),
    index("enrollments_course_idx").on(t.courseId, t.status),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** Null until the learner explicitly completes the lesson. */
    completedAt: ts("completed_at"),
    videoPositionSeconds: integer("video_position_seconds").notNull().default(0),
    lastAccessedAt: ts("last_accessed_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    index("lesson_progress_user_course_idx").on(t.userId, t.courseId),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const lessonNotes = pgTable(
  "lesson_notes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

/** Append-only learner activity feed. */
export const activityEvents = pgTable(
  "activity_events",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    link: text("link"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_events_user_idx").on(t.userId, t.createdAt)],
);

export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badge: text("badge").notNull(),
    awardedAt: ts("awarded_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badge] })],
);

import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, id, ts, updatedAt } from "./_shared";

export const courseStatus = pgEnum("course_status", [
  "draft",
  "pending_review",
  "published",
  "unpublished",
  "archived",
]);

export const courseLevel = pgEnum("course_level", [
  "beginner",
  "intermediate",
  "advanced",
  "all_levels",
]);

export const filePurpose = pgEnum("file_purpose", [
  "course_thumbnail",
  "lesson_resource",
  "lesson_video",
  "question_media",
  "submission",
  "branding",
]);

/**
 * Registry of every stored object. Access decisions are made from this row;
 * storage keys are never exposed to clients.
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    purpose: filePurpose("purpose").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Course the file belongs to, when it is course material. */
    courseId: uuid("course_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("files_course_idx").on(t.courseId),
    index("files_uploader_idx").on(t.uploadedBy),
  ],
);

export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const tags = pgTable("tags", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const courses = pgTable(
  "courses",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    thumbnailFileId: uuid("thumbnail_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    level: courseLevel("level").notNull().default("all_levels"),
    language: text("language").notNull().default("English"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    objectives: jsonb("objectives").$type<string[]>().notNull().default([]),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    /** Price in minor units (e.g. cents). 0 means the course is free. */
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("KES"),
    status: courseStatus("status").notNull().default("draft"),
    enrollmentOpen: boolean("enrollment_open").notNull().default(true),
    enrollmentLimit: integer("enrollment_limit"),
    // Completion policy
    requireAllLessons: boolean("require_all_lessons").notNull().default(true),
    requireAssessments: boolean("require_assessments").notNull().default(true),
    requireAssignments: boolean("require_assignments").notNull().default(true),
    certificateEnabled: boolean("certificate_enabled").notNull().default(true),
    reviewNote: text("review_note"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("courses_status_idx").on(t.status, t.publishedAt),
    index("courses_category_idx").on(t.categoryId),
    index("courses_owner_idx").on(t.ownerId),
  ],
);

export const courseTags = pgTable(
  "course_tags",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.tagId] })],
);

export const teachingRole = pgEnum("teaching_role", ["owner", "instructor"]);

/** Teaching team. The course owner always has a row here. */
export const courseInstructors = pgTable(
  "course_instructors",
  {
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: teachingRole("role").notNull().default("instructor"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.userId] }),
    index("course_instructors_user_idx").on(t.userId),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("modules_course_idx").on(t.courseId, t.position)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Markdown. Rendered without raw HTML. */
    content: text("content").notNull().default(""),
    /** External video (YouTube, Vimeo, or a direct media URL). */
    videoUrl: text("video_url"),
    videoFileId: uuid("video_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    position: integer("position").notNull().default(0),
    isPreview: boolean("is_preview").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("lessons_module_idx").on(t.moduleId, t.position),
    index("lessons_course_idx").on(t.courseId),
  ],
);

export const resourceKind = pgEnum("resource_kind", ["file", "link"]);

export const lessonResources = pgTable(
  "lesson_resources",
  {
    id: id(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: resourceKind("kind").notNull(),
    fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }),
    url: text("url"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("lesson_resources_lesson_idx").on(t.lessonId)],
);

export const liveProvider = pgEnum("live_provider", [
  "zoom",
  "google_meet",
  "microsoft_teams",
  "jitsi",
  "other",
]);

/** Link-based live classes. No provider API integration is implied. */
export const liveSessions = pgTable(
  "live_sessions",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    provider: liveProvider("provider").notNull().default("other"),
    joinUrl: text("join_url").notNull(),
    startsAt: ts("starts_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("live_sessions_course_idx").on(t.courseId, t.startsAt)],
);

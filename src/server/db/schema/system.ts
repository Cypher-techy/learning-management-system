import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses, lessons } from "./catalog";
import { enrollments } from "./learning";
import { createdAt, id, ts, updatedAt } from "./_shared";

// --- Certificates ----------------------------------------------------------

export const certificateTemplates = pgTable("certificate_templates", {
  id: id(),
  name: text("name").notNull(),
  heading: text("heading").notNull().default("Certificate of Completion"),
  /** Supports {{learner}}, {{course}} and {{date}} placeholders. */
  body: text("body")
    .notNull()
    .default("This certifies that {{learner}} has successfully completed {{course}}."),
  issuerName: text("issuer_name").notNull().default(""),
  signatoryName: text("signatory_name").notNull().default(""),
  signatoryTitle: text("signatory_title").notNull().default(""),
  accentColor: text("accent_color").notNull().default("#0f5c4d"),
  showScore: boolean("show_score").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const certificateStatus = pgEnum("certificate_status", ["valid", "revoked"]);

export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    /** Unguessable number printed on the certificate and used for verification. */
    number: text("number").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),
    templateId: uuid("template_id").references(() => certificateTemplates.id, {
      onDelete: "set null",
    }),
    // Snapshots, so a certificate stays accurate if names change later.
    learnerName: text("learner_name").notNull(),
    courseTitle: text("course_title").notNull(),
    score: doublePrecision("score"),
    status: certificateStatus("status").notNull().default("valid"),
    issuedAt: ts("issued_at").notNull().defaultNow(),
    revokedAt: ts("revoked_at"),
    revokedBy: uuid("revoked_by").references(() => users.id, {
      onDelete: "set null",
    }),
    revokeReason: text("revoke_reason"),
  },
  (t) => [
    uniqueIndex("certificates_enrollment_idx").on(t.enrollmentId),
    index("certificates_user_idx").on(t.userId),
  ],
);

// --- Communication ---------------------------------------------------------

export const discussions = pgTable(
  "discussions",
  {
    id: id(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").references(() => lessons.id, {
      onDelete: "set null",
    }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    isLocked: boolean("is_locked").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("discussions_course_idx").on(t.courseId, t.createdAt)],
);

export const discussionReplies = pgTable(
  "discussion_replies",
  {
    id: id(),
    discussionId: uuid("discussion_id")
      .notNull()
      .references(() => discussions.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("discussion_replies_discussion_idx").on(t.discussionId, t.createdAt)],
);

export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export const contentReports = pgTable(
  "content_reports",
  {
    id: id(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    discussionId: uuid("discussion_id").references(() => discussions.id, {
      onDelete: "cascade",
    }),
    replyId: uuid("reply_id").references(() => discussionReplies.id, {
      onDelete: "cascade",
    }),
    reason: text("reason").notNull(),
    status: reportStatus("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("content_reports_status_idx").on(t.status)],
);

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    /** Null for a platform-wide announcement (administrators only). */
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_course_idx").on(t.courseId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export const supportStatus = pgEnum("support_status", ["open", "in_progress", "closed"]);

export const supportRequests = pgTable(
  "support_requests",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: supportStatus("status").notNull().default("open"),
    adminNote: text("admin_note"),
    handledBy: uuid("handled_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("support_requests_status_idx").on(t.status, t.createdAt)],
);

// --- Payments --------------------------------------------------------------

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    /** Identifier issued by the provider when the payment was initiated. */
    providerReference: text("provider_reference").notNull(),
    /** Provider receipt number, available once the payment is confirmed. */
    receiptNumber: text("receipt_number"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    payerPhone: text("payer_phone"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_provider_reference_idx").on(t.provider, t.providerReference),
    index("payments_user_idx").on(t.userId, t.createdAt),
    index("payments_status_idx").on(t.status),
  ],
);

export const refundStatus = pgEnum("refund_status", [
  "requested",
  "approved",
  "rejected",
]);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => paymentTransactions.id, { onDelete: "restrict" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    status: refundStatus("status").notNull().default("requested"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNote: text("review_note"),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("refunds_transaction_idx").on(t.transactionId),
    index("refunds_status_idx").on(t.status),
  ],
);

// --- Operations ------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Fixed-window counters for application-level rate limiting. */
export const rateLimitHits = pgTable(
  "rate_limit_hits",
  {
    key: text("key").primaryKey(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
);

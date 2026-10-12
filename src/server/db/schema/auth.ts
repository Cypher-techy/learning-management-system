import {
  bigint,
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
import { createdAt, id, ts, updatedAt } from "./_shared";

export const userRole = pgEnum("user_role", ["student", "instructor", "admin"]);

// --- Tables owned by the authentication provider (Better Auth) -------------

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: text("role").notNull().default("student"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const rateLimits = pgTable("rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(0),
  lastRequest: bigint("last_request", { mode: "number" }).notNull().default(0),
});

// --- Application-owned identity tables -------------------------------------

export type NotificationPrefs = {
  /** Categories the user has switched off for email delivery. */
  emailOff: string[];
  /** Categories the user has switched off for in-app delivery. */
  inAppOff: string[];
};

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text("headline"),
  bio: text("bio"),
  phone: text("phone"),
  country: text("country"),
  timezone: text("timezone").notNull().default("Africa/Nairobi"),
  notificationPrefs: jsonb("notification_prefs")
    .$type<NotificationPrefs>()
    .notNull()
    .default({ emailOff: [], inAppOff: [] }),
  /** Set when the user asks for their account to be deleted. */
  deletionRequestedAt: ts("deletion_requested_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Admin-editable overrides on top of the default permission matrix. */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: userRole("role").notNull(),
    permission: text("permission").notNull(),
    allowed: boolean("allowed").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.role, t.permission] })],
);

export const applicationStatus = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
]);

export const instructorApplications = pgTable(
  "instructor_applications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expertise: text("expertise").notNull(),
    motivation: text("motivation").notNull(),
    status: applicationStatus("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNote: text("review_note"),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("instructor_applications_user_idx").on(t.userId),
    index("instructor_applications_status_idx").on(t.status),
  ],
);

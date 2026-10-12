import { AppError, forbidden } from "./errors";

export const ROLES = ["student", "instructor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Granular permissions. Ownership rules (for example "only the teaching team
 * may edit a course") are enforced separately inside the services; these keys
 * decide whether a role may use a capability at all.
 */
export const PERMISSIONS = {
  "course.create": "Create courses and manage the ones they teach",
  "course.publish_direct": "Publish courses without administrator review",
  "course.manage_any": "Manage every course on the platform",
  "course.review": "Approve or reject courses submitted for review",
  "question_bank.manage": "Create and reuse question banks",
  "grading.manage": "Grade submissions in courses they teach",
  "discussion.moderate": "Moderate discussions in courses they teach",
  "announcement.course": "Post announcements to courses they teach",
  "announcement.platform": "Post platform-wide announcements",
  "live_session.manage": "Schedule live sessions for courses they teach",
  "report.export": "Export reports as CSV",
  "user.manage": "Create, edit, suspend and reactivate users",
  "role.assign": "Change user roles and edit this permission matrix",
  "instructor.approve": "Review instructor applications",
  "category.manage": "Manage categories and tags",
  "enrollment.manage": "Grant, suspend and cancel enrollments",
  "assessment.oversee": "View all assessments and attempts",
  "certificate.manage": "Manage certificate templates and revoke certificates",
  "support.manage": "Handle support requests and reported content",
  "payment.manage": "View payments and decide refunds",
  "settings.manage": "Change platform settings",
  "audit.view": "View the security audit log",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const INSTRUCTOR_DEFAULTS: Permission[] = [
  "course.create",
  "question_bank.manage",
  "grading.manage",
  "discussion.moderate",
  "announcement.course",
  "live_session.manage",
  "report.export",
];

/** Default matrix. Administrators always hold every permission. */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  student: [],
  instructor: INSTRUCTOR_DEFAULTS,
  admin: ALL_PERMISSIONS,
};

/**
 * Permissions an administrator may grant to non-admin roles. Platform
 * governance permissions are deliberately not delegable to students.
 */
export const DELEGABLE: Record<Exclude<Role, "admin">, Permission[]> = {
  student: [],
  instructor: ALL_PERMISSIONS.filter((p) => p !== "role.assign" && p !== "settings.manage"),
};

export type PermissionOverride = { role: Role; permission: string; allowed: boolean };

export function resolvePermissions(role: Role, overrides: PermissionOverride[]): Set<Permission> {
  if (role === "admin") return new Set(ALL_PERMISSIONS);
  const set = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);
  const delegable = new Set<string>(DELEGABLE[role]);
  for (const o of overrides) {
    if (o.role !== role || !delegable.has(o.permission)) continue;
    if (o.allowed) set.add(o.permission as Permission);
    else set.delete(o.permission as Permission);
  }
  return set;
}

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Set<Permission>;
};

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  return !!actor && actor.permissions.has(permission);
}

export function assertCan(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  if (!actor.permissions.has(permission)) throw forbidden();
}

export function assertSignedIn(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
}

export function homeForRole(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "instructor") return "/instructor";
  return "/learn";
}

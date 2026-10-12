import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AppError, type AppErrorCode } from "@/server/errors";
import { resolvePermissions, type Actor, type Role } from "@/server/permissions";
import { expect } from "vitest";

let counter = 0;
const next = () => ++counter;

export async function makeUser(role: Role = "student", name?: string): Promise<Actor> {
  const n = next();
  const [user] = await db
    .insert(schema.users)
    .values({ name: name ?? `${role} ${n}`, email: `${role}${n}-${crypto.randomUUID().slice(0, 8)}@example.test`, role, emailVerified: true })
    .returning();
  await db.insert(schema.profiles).values({ userId: user!.id });
  return actorFor(user!.id);
}

/** Builds the actor exactly as a request would: from the database row. */
export async function actorFor(userId: string): Promise<Actor> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const overrides = await db.select().from(schema.rolePermissions);
  const role = user!.role as Role;
  return { id: user!.id, name: user!.name, email: user!.email, role, permissions: resolvePermissions(role, overrides) };
}

export async function makeCategory() {
  const n = next();
  const [row] = await db.insert(schema.categories).values({ name: `Category ${n}`, slug: `category-${n}` }).returning();
  return row!;
}

export type CourseFixture = {
  course: typeof schema.courses.$inferSelect;
  moduleId: string;
  lessonIds: string[];
};

/** Inserts a ready-made course directly, bypassing the editor workflow. */
export async function makeCourse(
  owner: Actor,
  options: { status?: (typeof schema.courseStatus.enumValues)[number]; lessons?: number; priceCents?: number } = {},
): Promise<CourseFixture> {
  const n = next();
  const category = await makeCategory();
  const status = options.status ?? "published";
  const [course] = await db
    .insert(schema.courses)
    .values({
      title: `Course ${n}`,
      slug: `course-${n}`,
      shortDescription: "A short description that is long enough.",
      description: "A full description of this course that comfortably exceeds the fifty character minimum.",
      ownerId: owner.id,
      categoryId: category.id,
      objectives: ["Understand the basics"],
      status,
      publishedAt: status === "published" ? new Date() : null,
      priceCents: options.priceCents ?? 0,
    })
    .returning();
  await db.insert(schema.courseInstructors).values({ courseId: course!.id, userId: owner.id, role: "owner" });
  const [mod] = await db.insert(schema.modules).values({ courseId: course!.id, title: "Module 1" }).returning();
  const lessonIds: string[] = [];
  for (let i = 0; i < (options.lessons ?? 2); i++) {
    const [lesson] = await db
      .insert(schema.lessons)
      .values({ courseId: course!.id, moduleId: mod!.id, title: `Lesson ${i + 1}`, content: "Lesson body.", position: i })
      .returning();
    lessonIds.push(lesson!.id);
  }
  return { course: course!, moduleId: mod!.id, lessonIds };
}

export async function expectAppError(promise: Promise<unknown>, code: AppErrorCode) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected an AppError(${code}) but the call succeeded`).toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

export const PDF_BYTES = Buffer.from("%PDF-1.4\n%test file\n");
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

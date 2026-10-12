import "server-only";
import { and, asc, count, desc, eq, gt, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "../db";

const { courses, categories, users, profiles, modules, lessons, enrollments, courseInstructors, tags, courseTags } = schema;

const enrolledCount = sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.courseId} = ${courses.id} and ${enrollments.status} in ('active','completed'))`;
const lessonCount = sql<number>`(select count(*)::int from ${lessons} join ${modules} on ${modules.id} = ${lessons.moduleId} where ${lessons.courseId} = ${courses.id} and ${lessons.isPublished} and ${modules.isPublished})`;

const cardColumns = {
  id: courses.id,
  slug: courses.slug,
  title: courses.title,
  shortDescription: courses.shortDescription,
  thumbnailFileId: courses.thumbnailFileId,
  level: courses.level,
  language: courses.language,
  estimatedMinutes: courses.estimatedMinutes,
  priceCents: courses.priceCents,
  currency: courses.currency,
  publishedAt: courses.publishedAt,
  categoryName: categories.name,
  instructorName: users.name,
  enrolledCount,
  lessonCount,
};

export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  thumbnailFileId: string | null;
  level: (typeof schema.courseLevel.enumValues)[number];
  language: string;
  estimatedMinutes: number;
  priceCents: number;
  currency: string;
  publishedAt: Date | null;
  categoryName: string | null;
  instructorName: string;
  enrolledCount: number;
  lessonCount: number;
};

export type CatalogFilters = {
  q?: string;
  category?: string;
  level?: string;
  price?: string;
  instructor?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Published courses only. Unpublished material never leaves this module. */
export async function listPublishedCourses(filters: CatalogFilters = {}) {
  const pageSize = Math.min(filters.pageSize ?? 12, 48);
  const page = Math.max(filters.page ?? 1, 1);
  const where: SQL[] = [eq(courses.status, "published")];

  const q = filters.q?.trim().slice(0, 100);
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    where.push(or(ilike(courses.title, pattern), ilike(courses.shortDescription, pattern), ilike(users.name, pattern))!);
  }
  if (filters.category) where.push(eq(categories.slug, filters.category));
  if (filters.level && (schema.courseLevel.enumValues as string[]).includes(filters.level)) {
    where.push(eq(courses.level, filters.level as (typeof schema.courseLevel.enumValues)[number]));
  }
  if (filters.price === "free") where.push(eq(courses.priceCents, 0));
  if (filters.price === "paid") where.push(gt(courses.priceCents, 0));
  if (filters.instructor && /^[0-9a-f-]{36}$/i.test(filters.instructor)) {
    where.push(eq(courses.ownerId, filters.instructor));
  }

  const order =
    filters.sort === "popular"
      ? [desc(enrolledCount), desc(courses.publishedAt)]
      : filters.sort === "title"
        ? [asc(courses.title)]
        : filters.sort === "price"
          ? [asc(courses.priceCents), asc(courses.title)]
          : [desc(courses.publishedAt)];

  const base = () =>
    db
      .select(cardColumns)
      .from(courses)
      .innerJoin(users, eq(users.id, courses.ownerId))
      .leftJoin(categories, eq(categories.id, courses.categoryId));

  const [rows, [total]] = await Promise.all([
    base()
      .where(and(...where))
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: count() })
      .from(courses)
      .innerJoin(users, eq(users.id, courses.ownerId))
      .leftJoin(categories, eq(categories.id, courses.categoryId))
      .where(and(...where)),
  ]);
  return { rows: rows as CourseCardData[], total: total?.n ?? 0, page, pageSize };
}

export async function listCategories() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      position: categories.position,
      courseCount: sql<number>`(select count(*)::int from ${courses} where ${courses.categoryId} = ${categories.id} and ${courses.status} = 'published')`,
    })
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name));
}

/** Instructors who own at least one published course (for the catalog filter). */
export async function listPublicInstructors() {
  return db
    .selectDistinct({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(courses, eq(courses.ownerId, users.id))
    .where(eq(courses.status, "published"))
    .orderBy(asc(users.name))
    .limit(200);
}

/** Real platform totals for the public site. */
export async function publicStats() {
  const [[c], [l], [k]] = await Promise.all([
    db.select({ n: count() }).from(courses).where(eq(courses.status, "published")),
    db
      .select({ n: sql<number>`count(distinct ${enrollments.userId})::int` })
      .from(enrollments)
      .where(inArray(enrollments.status, ["active", "completed"])),
    db.select({ n: count() }).from(schema.certificates).where(eq(schema.certificates.status, "valid")),
  ]);
  return { courses: c?.n ?? 0, learners: l?.n ?? 0, certificates: k?.n ?? 0 };
}

/** Full public detail of one published course, or null. */
export async function getPublishedCourse(slug: string) {
  const [course] = await db
    .select({ course: courses, categoryName: categories.name, categorySlug: categories.slug, enrolledCount })
    .from(courses)
    .leftJoin(categories, eq(categories.id, courses.categoryId))
    .where(and(eq(courses.slug, slug), eq(courses.status, "published")));
  if (!course) return null;
  const id = course.course.id;
  const [team, moduleRows, lessonRows, tagRows] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, headline: profiles.headline, bio: profiles.bio, role: courseInstructors.role })
      .from(courseInstructors)
      .innerJoin(users, eq(users.id, courseInstructors.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(courseInstructors.courseId, id))
      .orderBy(asc(courseInstructors.createdAt)),
    db
      .select({ id: modules.id, title: modules.title, description: modules.description })
      .from(modules)
      .where(and(eq(modules.courseId, id), eq(modules.isPublished, true)))
      .orderBy(asc(modules.position), asc(modules.createdAt)),
    // Titles only: lesson bodies and resources are never part of the public page.
    db
      .select({
        id: lessons.id,
        moduleId: lessons.moduleId,
        title: lessons.title,
        estimatedMinutes: lessons.estimatedMinutes,
        isPreview: lessons.isPreview,
      })
      .from(lessons)
      .where(and(eq(lessons.courseId, id), eq(lessons.isPublished, true)))
      .orderBy(asc(lessons.position), asc(lessons.createdAt)),
    db
      .select({ name: tags.name })
      .from(courseTags)
      .innerJoin(tags, eq(tags.id, courseTags.tagId))
      .where(eq(courseTags.courseId, id)),
  ]);
  return {
    ...course,
    team,
    modules: moduleRows.map((m) => ({ ...m, lessons: lessonRows.filter((l) => l.moduleId === m.id) })),
    tags: tagRows.map((t) => t.name),
  };
}

/** A preview lesson of a published course, viewable without enrolling. */
export async function getPreviewLesson(slug: string, lessonId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return null;
  const [row] = await db
    .select({ lesson: lessons, courseTitle: courses.title, courseSlug: courses.slug })
    .from(lessons)
    .innerJoin(courses, eq(courses.id, lessons.courseId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(courses.slug, slug),
        eq(courses.status, "published"),
        eq(lessons.isPublished, true),
        eq(modules.isPublished, true),
        eq(lessons.isPreview, true),
      ),
    );
  if (!row) return null;
  const resources = await db
    .select()
    .from(schema.lessonResources)
    .where(eq(schema.lessonResources.lessonId, lessonId))
    .orderBy(asc(schema.lessonResources.position), asc(schema.lessonResources.createdAt));
  return { ...row, resources };
}

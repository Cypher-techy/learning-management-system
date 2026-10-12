import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { can, homeForRole } from "@/server/permissions";
import { reviewApplication, applyToTeach, setRolePermissions } from "@/server/services/admin";
import {
  createCourse,
  createLesson,
  createModule,
  publicationIssues,
  requestPublication,
  reviewCourse,
  setCourseStatus,
  updateModule,
} from "@/server/services/courses";
import { enrollInFreeCourse } from "@/server/services/enrollment";
import { getLessonAccess } from "@/server/services/progress";
import { actorFor, expectAppError, makeCourse, makeUser } from "../helpers";

describe("database migrations", () => {
  it("apply cleanly and create the schema", async () => {
    const result = await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
    );
    const rows = (result as unknown as { rows?: Array<{ n: number }> }).rows ?? (result as unknown as Array<{ n: number }>);
    expect(rows[0]!.n).toBeGreaterThanOrEqual(45);
  });
});

describe("role routing and permissions", () => {
  it("sends each role to its own dashboard", () => {
    expect(homeForRole("student")).toBe("/learn");
    expect(homeForRole("instructor")).toBe("/instructor");
    expect(homeForRole("admin")).toBe("/admin");
  });

  it("gives students no management permissions", async () => {
    const student = await makeUser("student");
    expect([...student.permissions]).toEqual([]);
    await expectAppError(createCourse(student, { title: "Sneaky course" }), "FORBIDDEN");
  });

  it("never grants an instructor administrator-only permissions", async () => {
    const instructor = await makeUser("instructor");
    for (const p of ["user.manage", "role.assign", "settings.manage", "audit.view", "course.manage_any"] as const) {
      expect(can(instructor, p)).toBe(false);
    }
  });

  it("refuses to delegate governance permissions through the matrix", async () => {
    const admin = await makeUser("admin");
    // No credential account exists for this fixture, so confirmation must fail closed.
    await expectAppError(setRolePermissions(admin, "instructor", ["role.assign"], "whatever-password"), "VALIDATION");
    await db.insert(schema.rolePermissions).values([
      { role: "instructor", permission: "role.assign", allowed: true },
      { role: "student", permission: "course.create", allowed: true },
      { role: "instructor", permission: "course.publish_direct", allowed: true },
    ]);
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    expect(can(instructor, "role.assign")).toBe(false);
    expect(can(student, "course.create")).toBe(false);
    expect(can(instructor, "course.publish_direct")).toBe(true);
    await db.delete(schema.rolePermissions);
  });
});

describe("course ownership", () => {
  it("stops an instructor from modifying a course they do not teach", async () => {
    const owner = await makeUser("instructor");
    const other = await makeUser("instructor");
    const { course, moduleId } = await makeCourse(owner, { status: "draft" });

    await expectAppError(createModule(other, course.id, { title: "Hijack", description: "", isPublished: true }), "FORBIDDEN");
    await expectAppError(updateModule(other, moduleId, { title: "Renamed", description: "", isPublished: true }), "FORBIDDEN");
    await expectAppError(
      createLesson(other, moduleId, { title: "Injected lesson", description: "", content: "x", videoUrl: "", estimatedMinutes: 0, isPreview: false, isPublished: true }),
      "FORBIDDEN",
    );
    await expectAppError(setCourseStatus(other, course.id, "archive"), "FORBIDDEN");

    const [unchanged] = await db.select().from(schema.modules).where(eq(schema.modules.id, moduleId));
    expect(unchanged!.title).toBe("Module 1");
  });

  it("lets the owner and administrators manage it", async () => {
    const owner = await makeUser("instructor");
    const admin = await makeUser("admin");
    const { course } = await makeCourse(owner, { status: "draft" });
    await expect(createModule(owner, course.id, { title: "Mine", description: "", isPublished: true })).resolves.toBeTruthy();
    await expect(createModule(admin, course.id, { title: "Admin", description: "", isPublished: true })).resolves.toBeTruthy();
  });
});

describe("publication workflow", () => {
  it("blocks publishing an incomplete course", async () => {
    const instructor = await makeUser("instructor");
    const course = await createCourse(instructor, { title: "Empty course" });
    const issues = await publicationIssues(course.id);
    expect(issues.length).toBeGreaterThan(2);
    await expectAppError(requestPublication(instructor, course.id), "VALIDATION");
  });

  it("routes instructor courses through administrator review", async () => {
    const instructor = await makeUser("instructor");
    const admin = await makeUser("admin");
    const { course } = await makeCourse(instructor, { status: "draft" });

    expect(await requestPublication(instructor, course.id)).toBe("pending_review");
    await expectAppError(reviewCourse(instructor, course.id, "approve", ""), "FORBIDDEN");
    await reviewCourse(admin, course.id, "approve", "Looks good");

    const [row] = await db.select().from(schema.courses).where(eq(schema.courses.id, course.id));
    expect(row!.status).toBe("published");
    expect(row!.publishedAt).not.toBeNull();
  });
});

describe("unpublished material", () => {
  it("keeps draft courses closed to learners", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const draft = await makeCourse(instructor, { status: "draft" });

    await expectAppError(enrollInFreeCourse(student, draft.course.id), "NOT_FOUND");
    await expectAppError(getLessonAccess(student, draft.lessonIds[0]!), "NOT_FOUND");
    // The teaching team can still preview its own draft.
    const preview = await getLessonAccess(instructor, draft.lessonIds[0]!);
    expect(preview.staff).toBe(true);
  });

  it("hides unpublished lessons and archived courses from enrolled learners", async () => {
    const instructor = await makeUser("instructor");
    const student = await makeUser("student");
    const { course, lessonIds } = await makeCourse(instructor);
    await enrollInFreeCourse(student, course.id);
    await expect(getLessonAccess(student, lessonIds[0]!)).resolves.toBeTruthy();

    await db.update(schema.lessons).set({ isPublished: false }).where(eq(schema.lessons.id, lessonIds[1]!));
    await expectAppError(getLessonAccess(student, lessonIds[1]!), "NOT_FOUND");

    await db.update(schema.courses).set({ status: "archived" }).where(eq(schema.courses.id, course.id));
    await expectAppError(getLessonAccess(student, lessonIds[0]!), "NOT_FOUND");
  });

  it("requires enrollment to open lessons of a published course", async () => {
    const instructor = await makeUser("instructor");
    const outsider = await makeUser("student");
    const { lessonIds } = await makeCourse(instructor);
    await expectAppError(getLessonAccess(outsider, lessonIds[0]!), "FORBIDDEN");
  });
});

describe("instructor approval", () => {
  it("promotes a learner only through an approved application", async () => {
    const student = await makeUser("student");
    const admin = await makeUser("admin");
    await applyToTeach(student, {
      expertise: "Ten years teaching agronomy.",
      motivation: "I would like to publish a soil health course for farmers.",
    });
    const [application] = await db
      .select()
      .from(schema.instructorApplications)
      .where(eq(schema.instructorApplications.userId, student.id));

    await expectAppError(reviewApplication(student, application!.id, "approve", ""), "FORBIDDEN");
    expect((await actorFor(student.id)).role).toBe("student");

    await reviewApplication(admin, application!.id, "approve", "Welcome");
    const promoted = await actorFor(student.id);
    expect(promoted.role).toBe("instructor");
    expect(can(promoted, "course.create")).toBe(true);
  });
});

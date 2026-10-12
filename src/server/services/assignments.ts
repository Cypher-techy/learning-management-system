import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { roundMarks } from "@/lib/format";
import { db, schema, type DbOrTx } from "../db";
import { conflict, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, type Actor } from "../permissions";
import { logAudit } from "./audit";
import { assertCanManageCourse } from "./courses";
import { withNotifications } from "./notifications";
import { evaluateCompletion, LEARNER_VISIBLE_COURSE_STATUSES, recordActivity } from "./progress";

const { assignments, assignmentSubmissions, submissionFiles, files, courses, enrollments, users } = schema;

export type Assignment = typeof assignments.$inferSelect;
export type Submission = typeof assignmentSubmissions.$inferSelect;

export const assignmentSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    instructions: z.string().trim().max(20000).default(""),
    lessonId: z.string().uuid().nullable().default(null),
    dueAt: z.date().nullable().default(null),
    maxMarks: z.number().min(1).max(10000),
    passMarkPercent: z.number().int().min(0).max(100),
    allowText: z.boolean().default(true),
    allowFiles: z.boolean().default(true),
    allowedExtensions: z
      .array(z.string().trim().toLowerCase().regex(/^[a-z0-9]{1,8}$/))
      .max(20)
      .default([]),
    maxFiles: z.number().int().min(1).max(10).default(3),
    latePolicy: z.enum(schema.latePolicy.enumValues),
    latePenaltyPercent: z.number().int().min(0).max(100).default(0),
    allowResubmission: z.boolean().default(true),
    requiredForCompletion: z.boolean().default(true),
  })
  .refine((a) => a.allowText || a.allowFiles, {
    path: ["allowText"],
    message: "Allow a written response, file uploads, or both.",
  });

export type AssignmentInput = z.input<typeof assignmentSchema>;

async function loadAssignment(conn: DbOrTx, assignmentId: string) {
  const [row] = await conn.select().from(assignments).where(eq(assignments.id, assignmentId));
  if (!row) throw notFound("The assignment");
  return row;
}

async function assertLessonInCourse(lessonId: string | null, courseId: string) {
  if (!lessonId) return;
  const [lesson] = await db
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(and(eq(schema.lessons.id, lessonId), eq(schema.lessons.courseId, courseId)));
  if (!lesson) throw invalid("Choose a lesson from this course.");
}

// --- Instructor ------------------------------------------------------------

export async function createAssignment(actor: Actor, courseId: string, input: AssignmentInput) {
  const data = assignmentSchema.parse(input);
  await assertCanManageCourse(actor, courseId);
  await assertLessonInCourse(data.lessonId, courseId);
  const [row] = await db.insert(assignments).values({ ...data, courseId, createdBy: actor.id }).returning();
  return row!;
}

export async function updateAssignment(actor: Actor, assignmentId: string, input: AssignmentInput) {
  const data = assignmentSchema.parse(input);
  const assignment = await loadAssignment(db, assignmentId);
  await assertCanManageCourse(actor, assignment.courseId);
  await assertLessonInCourse(data.lessonId, assignment.courseId);
  await db.update(assignments).set(data).where(eq(assignments.id, assignmentId));
  return assignment;
}

export async function setAssignmentPublished(actor: Actor, assignmentId: string, published: boolean) {
  return withNotifications(async (tx, notify) => {
    const assignment = await loadAssignment(tx, assignmentId);
    const course = await assertCanManageCourse(actor, assignment.courseId, tx);
    await tx.update(assignments).set({ isPublished: published }).where(eq(assignments.id, assignmentId));
    if (published && !assignment.isPublished && course.status === "published") {
      const learners = await tx
        .select({ id: enrollments.userId })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, course.id), eq(enrollments.status, "active")));
      await notify({
        userIds: learners.map((l) => l.id),
        category: "assessment",
        title: `New assignment in ${course.title}: ${assignment.title}`,
        body: assignment.dueAt ? `Due ${assignment.dueAt.toUTCString()}.` : undefined,
        link: `/learn/assignments/${assignmentId}`,
      });
    }
    return assignment;
  });
}

export async function deleteAssignment(actor: Actor, assignmentId: string) {
  const assignment = await loadAssignment(db, assignmentId);
  await assertCanManageCourse(actor, assignment.courseId);
  const [submitted] = await db
    .select({ n: count() })
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.assignmentId, assignmentId));
  if ((submitted?.n ?? 0) > 0) {
    throw conflict("Learners have submitted work for this assignment. Unpublish it instead of deleting it.");
  }
  await db.delete(assignments).where(eq(assignments.id, assignmentId));
  return assignment;
}

export async function listSubmissions(actor: Actor, assignmentId: string) {
  assertCan(actor, "grading.manage");
  const assignment = await loadAssignment(db, assignmentId);
  const course = await assertCanManageCourse(actor, assignment.courseId);
  const rows = await db
    .select({ submission: assignmentSubmissions, learnerName: users.name, learnerEmail: users.email })
    .from(assignmentSubmissions)
    .innerJoin(users, eq(users.id, assignmentSubmissions.userId))
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), inArray(assignmentSubmissions.status, ["submitted", "graded"])))
    .orderBy(desc(assignmentSubmissions.submittedAt));
  return { assignment, course, rows };
}

async function submissionFilesFor(conn: DbOrTx, submissionId: string) {
  return conn
    .select({ id: files.id, name: files.originalName, size: files.size, mimeType: files.mimeType })
    .from(submissionFiles)
    .innerJoin(files, eq(files.id, submissionFiles.fileId))
    .where(eq(submissionFiles.submissionId, submissionId))
    .orderBy(asc(submissionFiles.createdAt));
}

export async function getSubmissionForGrading(actor: Actor, submissionId: string) {
  assertCan(actor, "grading.manage");
  const [submission] = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.id, submissionId));
  if (!submission) throw notFound("The submission");
  const assignment = await loadAssignment(db, submission.assignmentId);
  const course = await assertCanManageCourse(actor, assignment.courseId);
  if (submission.status === "draft") throw notFound("The submission");
  const [[learner], attachments] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, submission.userId)),
    submissionFilesFor(db, submissionId),
  ]);
  return { submission, assignment, course, learner: learner!, attachments };
}

export const gradeSubmissionSchema = z.object({
  marks: z.number().min(0).max(10000),
  feedback: z.string().trim().max(10000).default(""),
  release: z.boolean().default(true),
});

/**
 * Grades a submission. The configured late penalty is applied here, on the
 * server, to the mark the instructor enters.
 */
export async function gradeSubmission(actor: Actor, submissionId: string, input: z.input<typeof gradeSubmissionSchema>) {
  assertCan(actor, "grading.manage");
  const data = gradeSubmissionSchema.parse(input);
  return withNotifications(async (tx, notify) => {
    const [submission] = await tx
      .select()
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, submissionId))
      .for("update");
    if (!submission) throw notFound("The submission");
    const assignment = await loadAssignment(tx, submission.assignmentId);
    await assertCanManageCourse(actor, assignment.courseId, tx);
    if (submission.status === "draft") throw conflict("This work has not been submitted yet.");
    if (data.marks > assignment.maxMarks) {
      throw invalid(`Marks cannot exceed ${assignment.maxMarks}.`, { marks: [`Maximum is ${assignment.maxMarks}.`] });
    }
    const penalised =
      submission.isLate && assignment.latePolicy === "penalty"
        ? data.marks * (1 - assignment.latePenaltyPercent / 100)
        : data.marks;
    const now = new Date();
    const releasedAt = data.release ? (submission.releasedAt ?? now) : null;
    await tx
      .update(assignmentSubmissions)
      .set({
        status: "graded",
        marks: roundMarks(penalised),
        feedback: data.feedback || null,
        gradedBy: actor.id,
        gradedAt: now,
        releasedAt,
      })
      .where(eq(assignmentSubmissions.id, submissionId));
    await logAudit(tx, {
      actorId: actor.id,
      action: "submission.grade",
      entityType: "assignment_submission",
      entityId: submissionId,
      metadata: { marks: roundMarks(penalised), released: !!releasedAt },
    });
    if (releasedAt) {
      await notify({
        userIds: [submission.userId],
        category: "grade",
        title: `Your assignment was graded: ${assignment.title}`,
        link: `/learn/assignments/${assignment.id}`,
      });
      await evaluateCompletion(tx, notify, submission.userId, assignment.courseId);
    }
    return { assignment, submission };
  });
}

// --- Learner ---------------------------------------------------------------

async function assertLearnerCanSee(conn: DbOrTx, actor: Actor, assignment: Assignment) {
  const [course] = await conn.select().from(courses).where(eq(courses.id, assignment.courseId));
  const available =
    !!course && (LEARNER_VISIBLE_COURSE_STATUSES as readonly string[]).includes(course.status) && assignment.isPublished;
  if (!available) throw notFound("The assignment");
  const [enrollment] = await conn
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, actor.id), eq(enrollments.courseId, assignment.courseId)));
  if (!enrollment || (enrollment.status !== "active" && enrollment.status !== "completed")) {
    throw forbidden("Enroll in this course to see its assignments.");
  }
  return course!;
}

/** A learner's view of an assignment. Marks and feedback appear only once released. */
export async function getAssignmentForLearner(actor: Actor, assignmentId: string) {
  assertSignedIn(actor);
  const assignment = await loadAssignment(db, assignmentId);
  const course = await assertLearnerCanSee(db, actor, assignment);
  const [submission] = await db
    .select()
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, actor.id)));
  const attachments = submission ? await submissionFilesFor(db, submission.id) : [];
  const released = !!submission?.releasedAt;
  return {
    assignment,
    course,
    submission: submission
      ? {
          id: submission.id,
          // An unreleased grade looks like "submitted" to the learner.
          status: submission.status === "graded" && !released ? ("submitted" as const) : submission.status,
          textResponse: submission.textResponse,
          submittedAt: submission.submittedAt,
          isLate: submission.isLate,
          submissionCount: submission.submissionCount,
          marks: released ? submission.marks : null,
          feedback: released ? submission.feedback : null,
        }
      : null,
    attachments,
    canEdit: canEditSubmission(assignment, submission ?? null),
  };
}

export function canEditSubmission(assignment: Assignment, submission: Submission | null, now = new Date()): boolean {
  if (submission?.status === "graded") return false;
  if (submission?.status === "submitted" && !assignment.allowResubmission) return false;
  if (assignment.dueAt && now > assignment.dueAt && assignment.latePolicy === "reject") return false;
  return true;
}

export const submissionSchema = z.object({
  textResponse: z.string().max(100_000).default(""),
  fileIds: z.array(z.string().uuid()).max(10).default([]),
  submit: z.boolean(),
});

/** Saves a draft or submits the work. Deadlines and file rules are enforced here. */
export async function saveSubmission(actor: Actor, assignmentId: string, input: z.input<typeof submissionSchema>) {
  assertSignedIn(actor);
  const data = submissionSchema.parse(input);
  return withNotifications(async (tx, notify) => {
    const assignment = await loadAssignment(tx, assignmentId);
    const course = await assertLearnerCanSee(tx, actor, assignment);
    const [existing] = await tx
      .select()
      .from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.assignmentId, assignmentId), eq(assignmentSubmissions.userId, actor.id)))
      .for("update");
    const now = new Date();
    if (existing?.status === "graded") throw conflict("This assignment has already been graded.");
    if (existing?.status === "submitted" && !assignment.allowResubmission) {
      throw conflict("Resubmission is not allowed for this assignment.");
    }
    const late = !!assignment.dueAt && now > assignment.dueAt;
    if (late && assignment.latePolicy === "reject") {
      throw conflict("The deadline has passed and late submissions are not accepted.");
    }

    const text = assignment.allowText ? data.textResponse : "";
    const fileIds = assignment.allowFiles ? [...new Set(data.fileIds)] : [];
    if (fileIds.length > assignment.maxFiles) throw invalid(`Attach at most ${assignment.maxFiles} file(s).`);
    if (fileIds.length > 0) {
      const owned = await tx.select().from(files).where(inArray(files.id, fileIds));
      const bad = owned.length !== fileIds.length || owned.some((f) => f.uploadedBy !== actor.id || f.purpose !== "submission");
      if (bad) throw invalid("One of the attached files cannot be used.");
      if (assignment.allowedExtensions.length > 0) {
        const wrong = owned.find((f) => {
          const ext = f.originalName.split(".").pop()?.toLowerCase() ?? "";
          return !assignment.allowedExtensions.includes(ext);
        });
        if (wrong) {
          throw invalid(`"${wrong.originalName}" is not an accepted file type (${assignment.allowedExtensions.join(", ")}).`);
        }
      }
    }
    if (data.submit && text.trim() === "" && fileIds.length === 0) {
      throw invalid("Add a written response or attach a file before submitting.");
    }

    const fields = {
      textResponse: text,
      status: data.submit ? ("submitted" as const) : (existing?.status ?? ("draft" as const)),
      ...(data.submit
        ? { submittedAt: now, isLate: late, submissionCount: (existing?.submissionCount ?? 0) + 1 }
        : {}),
    };
    let submissionId: string;
    if (existing) {
      await tx.update(assignmentSubmissions).set(fields).where(eq(assignmentSubmissions.id, existing.id));
      submissionId = existing.id;
    } else {
      const [created] = await tx
        .insert(assignmentSubmissions)
        .values({ ...fields, assignmentId, userId: actor.id })
        .returning({ id: assignmentSubmissions.id });
      submissionId = created!.id;
    }
    await tx.delete(submissionFiles).where(eq(submissionFiles.submissionId, submissionId));
    if (fileIds.length > 0) {
      await tx.insert(submissionFiles).values(fileIds.map((fileId) => ({ submissionId, fileId })));
    }
    if (data.submit) {
      await recordActivity(tx, {
        userId: actor.id,
        courseId: course.id,
        type: "assignment_submitted",
        summary: `Submitted assignment: ${assignment.title}`,
        link: `/learn/assignments/${assignmentId}`,
      });
      await notify({
        userIds: [actor.id],
        category: "submission",
        title: `Submission received: ${assignment.title}`,
        body: late ? "This submission was received after the deadline." : undefined,
        link: `/learn/assignments/${assignmentId}`,
      });
    }
    return { submitted: data.submit, late };
  });
}

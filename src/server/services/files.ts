import { and, eq, or } from "drizzle-orm";
import { db, schema } from "../db";
import { AppError, forbidden, invalid, notFound } from "../errors";
import { assertCan, assertSignedIn, can, type Actor } from "../permissions";
import { assertCanManageCourse, canManageCourse } from "./courses";
import { LEARNER_VISIBLE_COURSE_STATUSES } from "./progress";
import { getSettings } from "./settings";
import { getStorage } from "./storage";

const { files, lessons, lessonResources, modules, courses, enrollments } = schema;

export type StoredFile = typeof files.$inferSelect;
export type FilePurpose = StoredFile["purpose"];

/** The content type is always derived from the extension, never trusted from the client. */
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const VIDEO_EXTENSIONS = ["mp4", "webm"];

/** Types a browser may render in place. Everything else is forced to download. */
const INLINE_SAFE = new Set(["png", "jpg", "jpeg", "gif", "webp", "pdf", "mp4", "webm", "mp3"]);

const startsWith = (bytes: Buffer, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/** Checks that the leading bytes are consistent with the claimed extension. */
export function contentMatchesExtension(ext: string, bytes: Buffer): boolean {
  switch (ext) {
    case "pdf":
      return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "gif":
      return bytes.subarray(0, 4).toString("latin1") === "GIF8";
    case "webp":
      return bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
    case "zip":
    case "docx":
    case "xlsx":
    case "pptx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "doc":
    case "xls":
    case "ppt":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]);
    case "mp4":
      return bytes.subarray(4, 8).toString("latin1") === "ftyp";
    case "webm":
      return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    case "mp3":
      return bytes.subarray(0, 3).toString("latin1") === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
    case "txt":
    case "csv":
      return !bytes.subarray(0, 8192).includes(0);
    default:
      return false;
  }
}

export type UploadInput = {
  purpose: FilePurpose;
  courseId: string | null;
  filename: string;
  bytes: Buffer;
};

/**
 * Validates and stores an upload. Authorization, size, extension and content
 * are all checked on the server before anything reaches storage.
 */
export async function uploadFile(actor: Actor, input: UploadInput): Promise<StoredFile> {
  assertSignedIn(actor);
  const settings = await getSettings();
  const name = input.filename.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").trim().slice(-160) || "file";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

  let allowed: string[];
  let maxBytes = settings.maxUploadMb * 1024 * 1024;
  switch (input.purpose) {
    case "course_thumbnail":
      if (!input.courseId) throw invalid("A course is required for this upload.");
      await assertCanManageCourse(actor, input.courseId);
      allowed = IMAGE_EXTENSIONS;
      maxBytes = Math.min(maxBytes, 5 * 1024 * 1024);
      break;
    case "lesson_video":
      if (!input.courseId) throw invalid("A course is required for this upload.");
      await assertCanManageCourse(actor, input.courseId);
      allowed = VIDEO_EXTENSIONS;
      break;
    case "lesson_resource":
      if (!input.courseId) throw invalid("A course is required for this upload.");
      await assertCanManageCourse(actor, input.courseId);
      allowed = settings.allowedUploadExtensions;
      break;
    case "submission": {
      if (!input.courseId) throw invalid("A course is required for this upload.");
      const [enrollment] = await db
        .select({ status: enrollments.status })
        .from(enrollments)
        .where(and(eq(enrollments.userId, actor.id), eq(enrollments.courseId, input.courseId)));
      if (!enrollment || (enrollment.status !== "active" && enrollment.status !== "completed")) {
        throw forbidden("You are not enrolled in this course.");
      }
      allowed = settings.allowedUploadExtensions;
      break;
    }
    case "branding":
      assertCan(actor, "settings.manage");
      allowed = IMAGE_EXTENSIONS;
      maxBytes = Math.min(maxBytes, 2 * 1024 * 1024);
      break;
    default:
      throw invalid("Unsupported upload type.");
  }

  if (!ext || !MIME[ext] || !allowed.includes(ext)) {
    throw invalid(`This file type is not allowed. Accepted types: ${allowed.filter((e) => MIME[e]).join(", ")}.`);
  }
  if (input.bytes.length === 0) throw invalid("The file is empty.");
  if (input.bytes.length > maxBytes) {
    throw invalid(`The file is too large. The limit is ${Math.floor(maxBytes / (1024 * 1024))} MB.`);
  }
  if (!contentMatchesExtension(ext, input.bytes)) {
    throw invalid("The file's contents do not match its type. Upload the original, unmodified file.");
  }

  const storageKey = `${input.purpose}/${crypto.randomUUID()}.${ext}`;
  await getStorage().put(storageKey, input.bytes, MIME[ext]!);
  try {
    const [row] = await db
      .insert(files)
      .values({
        storageKey,
        originalName: name,
        mimeType: MIME[ext]!,
        size: input.bytes.length,
        purpose: input.purpose,
        uploadedBy: actor.id,
        courseId: input.purpose === "branding" ? null : input.courseId,
      })
      .returning();
    return row!;
  } catch (error) {
    await getStorage().delete(storageKey).catch(() => {});
    throw error;
  }
}

export type AuthorizedFile = { file: StoredFile; inline: boolean };

/**
 * Decides whether the (possibly anonymous) actor may read a file. Unauthorized
 * requests receive "not found" so that file ids cannot be probed.
 */
export async function authorizeFileAccess(actor: Actor | null, fileId: string): Promise<AuthorizedFile> {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw notFound("The file");
  const [file] = await db.select().from(files).where(eq(files.id, fileId));
  if (!file) throw notFound("The file");
  const ext = file.originalName.split(".").pop()?.toLowerCase() ?? "";
  const ok: AuthorizedFile = { file, inline: INLINE_SAFE.has(ext) };

  if (file.purpose === "branding") return ok;

  if (file.purpose === "submission") {
    if (actor && file.uploadedBy === actor.id) return ok;
    if (actor && file.courseId && can(actor, "grading.manage") && (await canManageCourse(actor, file.courseId))) {
      return ok;
    }
    throw notFound("The file");
  }

  if (!file.courseId) throw notFound("The file");
  if (actor && (await canManageCourse(actor, file.courseId))) return ok;

  const [course] = await db.select().from(courses).where(eq(courses.id, file.courseId));
  if (!course) throw notFound("The file");

  if (file.purpose === "course_thumbnail") {
    if (course.thumbnailFileId === file.id && (LEARNER_VISIBLE_COURSE_STATUSES as readonly string[]).includes(course.status)) {
      return ok;
    }
    throw notFound("The file");
  }

  // Lesson material: find the published lessons that use this file.
  const usedBy = await db
    .selectDistinct({ lessonId: lessons.id, isPreview: lessons.isPreview })
    .from(lessons)
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .leftJoin(lessonResources, eq(lessonResources.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.courseId, course.id),
        eq(lessons.isPublished, true),
        eq(modules.isPublished, true),
        or(eq(lessons.videoFileId, file.id), eq(lessonResources.fileId, file.id)),
      ),
    );
  if (usedBy.length === 0) throw notFound("The file");
  if (course.status === "published" && usedBy.some((l) => l.isPreview)) return ok;
  if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  if (!(LEARNER_VISIBLE_COURSE_STATUSES as readonly string[]).includes(course.status)) throw notFound("The file");
  const [enrollment] = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, actor.id), eq(enrollments.courseId, course.id)));
  if (enrollment && (enrollment.status === "active" || enrollment.status === "completed")) return ok;
  throw notFound("The file");
}

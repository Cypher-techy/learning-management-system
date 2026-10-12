import { getActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { uploadFile, type FilePurpose } from "@/server/services/files";
import { rateLimit } from "@/server/services/ratelimit";
import { getSettings } from "@/server/services/settings";

const PURPOSES: FilePurpose[] = ["course_thumbnail", "lesson_resource", "lesson_video", "submission", "branding"];

export const maxDuration = 60;

/** Multipart upload. All validation happens in `uploadFile`. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await getActor();
    if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
    await rateLimit(`upload:${actor.id}`, 60, 600);

    const settings = await getSettings();
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > (settings.maxUploadMb + 1) * 1024 * 1024) {
      throw new AppError("VALIDATION", `The file is too large. The limit is ${settings.maxUploadMb} MB.`);
    }

    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") ?? "") as FilePurpose;
    const courseId = String(form.get("courseId") ?? "") || null;
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Choose a file to upload.");
    if (!PURPOSES.includes(purpose)) throw new AppError("VALIDATION", "Unsupported upload type.");
    if (courseId && !/^[0-9a-f-]{36}$/i.test(courseId)) throw new AppError("VALIDATION", "Invalid course.");

    const stored = await uploadFile(actor, {
      purpose,
      courseId,
      filename: file.name,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return Response.json(
      { id: stored.id, name: stored.originalName, size: stored.size },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

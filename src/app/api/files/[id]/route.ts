import { getActor } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { authorizeFileAccess } from "@/server/services/files";
import { getStorage } from "@/server/services/storage";

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * The only way to read a stored file. Every request is authorized against the
 * file's database record; storage keys and bucket URLs are never exposed.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { file, inline } = await authorizeFileAccess(await getActor(), id);
    const attachment = !inline || new URL(request.url).searchParams.has("download");
    const filename = file.originalName.replace(/[^\w.\- ]/g, "_");
    const storage = getStorage();
    const isPublicImage = file.purpose === "branding" || file.purpose === "course_thumbnail";

    if (storage.signedUrl) {
      const url = await storage.signedUrl(
        file.storageKey,
        { filename, contentType: file.mimeType, attachment },
        SIGNED_URL_TTL_SECONDS,
      );
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
    }

    if (!storage.read) throw new Error("Storage driver cannot read files.");
    const rangeHeader = request.headers.get("range");
    const match = rangeHeader ? /^bytes=(\d+)-(\d*)$/.exec(rangeHeader) : null;
    const range = match ? { start: Number(match[1]), end: match[2] ? Number(match[2]) : undefined } : undefined;
    const result = await storage.read(file.storageKey, range);

    const headers = new Headers({
      "Content-Type": file.mimeType,
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${filename}"`,
      "Content-Length": String(result.end - result.start + 1),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": isPublicImage ? "public, max-age=300" : "private, no-store",
    });
    if (result.partial) headers.set("Content-Range", `bytes ${result.start}-${result.end}/${result.size}`);
    return new Response(result.stream, { status: result.partial ? 206 : 200, headers });
  } catch (error) {
    return errorResponse(error);
  }
}

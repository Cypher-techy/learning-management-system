import { getActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { errorResponse } from "@/server/http";
import { getCertificateForDownload, renderCertificatePdf } from "@/server/services/certificates";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("NOT_FOUND", "The certificate could not be found.");
    const certificate = await getCertificateForDownload(actor, id);
    const pdf = await renderCertificatePdf(certificate);
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${certificate.number}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

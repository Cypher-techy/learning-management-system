import { toCsv } from "@/lib/format";
import { getActor } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { errorResponse } from "@/server/http";
import { buildExport } from "@/server/queries/exports";

/** CSV downloads for authorized reports. Each export is written to the audit log. */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
    const { report } = await params;
    const { filename, rows } = await buildExport(actor, report, new URL(request.url).searchParams);
    const date = new Date().toISOString().slice(0, 10);
    // The BOM makes spreadsheet applications read the file as UTF-8.
    return new Response(`﻿${toCsv(rows)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-${date}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

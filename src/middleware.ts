import { NextRequest, NextResponse } from "next/server";
/** First gate for protected areas. Full session + role verification always
 *  happens server-side in API routes (roles are read from the DB). */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get("edvora_session")?.value;
  const isAdminArea = pathname === "/auth/administrator" || pathname.startsWith("/dashboard/admin");

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const response = NextResponse.redirect(new URL(isAdminArea ? "/auth/administrator" : "/roles", req.url));
    if (isAdminArea) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const response = NextResponse.next();
  if (isAdminArea) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/auth/administrator"] };

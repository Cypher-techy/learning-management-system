import { NextRequest, NextResponse } from "next/server";
/** First gate for protected areas. Full session + role verification always
 *  happens server-side in API routes (roles are read from the DB). */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get("edvora_session")?.value;
  if (pathname.startsWith("/dashboard") && !hasSession) {
    return NextResponse.redirect(new URL("/roles", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*"] };

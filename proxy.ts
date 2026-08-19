import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/http/session-cookie";

export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (request.nextUrl.pathname.startsWith("/painel") && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (request.nextUrl.pathname === "/login" && hasSessionCookie) {
    return NextResponse.redirect(new URL("/painel", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/painel/:path*"]
};

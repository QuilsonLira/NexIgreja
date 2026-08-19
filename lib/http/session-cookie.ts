import type { NextRequest, NextResponse } from "next/server";
import { getAuthConfig } from "@/lib/auth/config";

export const SESSION_COOKIE_NAME = "nexigreja_session";

export function readSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function setSessionCookie(response: NextResponse, token: string): void {
  const config = getAuthConfig();
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlHours * 60 * 60,
    priority: "high"
  });
}

export function clearSessionCookie(response: NextResponse): void {
  const config = getAuthConfig();
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    priority: "high"
  });
}

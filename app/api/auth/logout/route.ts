import { assertTrustedOrigin, clearSessionCookie, errorResponse, logout } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { assertTrustedOrigin(request); await logout(request); return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie(request), "Cache-Control": "no-store" } }); }
  catch (error) { const response = errorResponse(error); response.headers.append("Set-Cookie", clearSessionCookie(request)); return response; }
}

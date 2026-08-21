import { clearSessionCookie, errorResponse, me } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return Response.json({ ok: true, session: await me(request) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { const response = errorResponse(error); if (response.status === 401) response.headers.append("Set-Cookie", clearSessionCookie(request)); return response; }
}

import { assertTrustedOrigin, errorResponse, login } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json() as { identifier?: unknown; password?: unknown };
    if (typeof body.identifier !== "string" || typeof body.password !== "string" || body.identifier.length > 254) return Response.json({ error: { code: "DADOS_INVALIDOS", message: "Preencha seu acesso e sua senha." } }, { status: 400 });
    const result = await login(request, body.identifier, body.password, "ORGANIZATIONAL");
    const headers = new Headers({ "Cache-Control": "no-store" });
    if (result.cookie) headers.set("Set-Cookie", result.cookie);
    return Response.json({
      ok: true,
      session: result.payload,
      organizations: result.organizations,
      requiresOrganizationSelection: result.requiresOrganizationSelection,
    }, { headers });
  } catch (error) { return errorResponse(error); }
}

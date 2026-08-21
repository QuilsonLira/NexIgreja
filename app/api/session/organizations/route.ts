import { assertTrustedOrigin, errorResponse, organizationOptions, switchOrganization } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json({ organizations: await organizationOptions(request) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json() as { membershipId?: unknown };
    if (!Number.isInteger(body.membershipId) || Number(body.membershipId) <= 0) {
      return Response.json({ error: { code: "DADOS_INVALIDOS", message: "Selecione uma organização válida." } }, { status: 400 });
    }
    return Response.json({ ok: true, session: await switchOrganization(request, Number(body.membershipId)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

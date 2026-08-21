import { acceptOrganizationInvite, assertTrustedOrigin, errorResponse } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const membershipId = Number((await context.params).id);
    if (!Number.isInteger(membershipId) || membershipId <= 0) {
      return Response.json({ error: { code: "DADOS_INVALIDOS", message: "Convite inválido." } }, { status: 400 });
    }
    return Response.json({ ok: true, session: await acceptOrganizationInvite(request, membershipId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

import { assertTrustedOrigin, clearInstitutionCookie, currentInstitution, errorResponse, identifyInstitution } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json({ institution: await currentInstitution(request) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json() as { code?: unknown };
    if (typeof body.code !== "string") return Response.json({ error: { code: "DADOS_INVALIDOS", message: "Informe os 7 números do código da instituição." } }, { status: 400 });
    const result = await identifyInstitution(request, body.code);
    return Response.json({ ok: true, institution: result.institution }, { headers: { "Set-Cookie": result.cookie, "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedOrigin(request);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearInstitutionCookie(request), "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

import { assertTrustedOrigin, changeContext, clearSessionCookie, errorResponse } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json() as { conventionId?: unknown; matrixId?: unknown; branchId?: unknown };
    const conventionId = body.conventionId === null || body.conventionId === undefined ? null : Number(body.conventionId);
    const matrixId = body.matrixId === null || body.matrixId === undefined ? null : Number(body.matrixId);
    const branchId = body.branchId === null || body.branchId === undefined ? null : Number(body.branchId);
    const validId = (value: number | null) => value === null || (Number.isInteger(value) && value > 0);
    const validShape = validId(conventionId) && validId(matrixId) && validId(branchId)
      && ((conventionId !== null && matrixId === null && branchId === null) || (conventionId === null && matrixId !== null));
    if (!validShape) return Response.json({ error: { code: "CONTEXTO_INVALIDO", message: "Escolha uma unidade válida." } }, { status: 400 });
    return Response.json({ ok: true, session: await changeContext(request, matrixId, branchId, conventionId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const response = errorResponse(error); if (response.status === 401) response.headers.append("Set-Cookie", clearSessionCookie(request)); return response; }
}

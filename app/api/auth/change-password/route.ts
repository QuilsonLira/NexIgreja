import { assertTrustedOrigin, changePassword, errorResponse } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const body = await request.json() as { currentPassword?: unknown; newPassword?: unknown; confirmPassword?: unknown };
    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string" || body.newPassword !== body.confirmPassword) return Response.json({ error: { code: "DADOS_INVALIDOS", message: "Confira os campos informados." } }, { status: 400 });
    const result = await changePassword(request, body.currentPassword, body.newPassword);
    return Response.json(
      { ok: true, session: result.payload, message: "Senha alterada com sucesso." },
      { headers: { "Set-Cookie": result.cookie, "Cache-Control": "no-store" } },
    );
  } catch (error) { return errorResponse(error); }
}

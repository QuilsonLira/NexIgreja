import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId, unitType } from "@/lib/admin/http";
import { permanentlyDeletePlatformUnit } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ type: string; id: string }> };
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    if (typeof body.password !== "string" || typeof body.confirmation !== "string") {
      throw new ApiError(400, "CONFIRMACAO_INVALIDA", "Informe sua senha e a confirmação digitada.");
    }
    const params = await context.params;
    await permanentlyDeletePlatformUnit(request, unitType(params.type), positiveId(params.id), { password: body.password, confirmation: body.confirmation });
    return adminJson({ ok: true, message: "Unidade excluída definitivamente." });
  } catch (error) {
    return adminRouteError(error);
  }
}

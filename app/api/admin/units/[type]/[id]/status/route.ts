import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId, unitType } from "@/lib/admin/http";
import { setAdminUnitStatus } from "@/lib/server/admin";

type RouteContext = { params: Promise<{ type: string; id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const body = await adminBody(request);
    if (body.status !== "ATIVO" && body.status !== "INATIVO") throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
    const unit = await setAdminUnitStatus(request, unitType(params.type), positiveId(params.id), body.status);
    return adminJson({ ok: true, unit, message: body.status === "ATIVO" ? "Unidade ativada com sucesso." : "Unidade desativada com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

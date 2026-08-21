import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId, unitType, unitWriteFields } from "@/lib/admin/http";
import { getAdminUnit, updateAdminUnit } from "@/lib/server/admin";

type RouteContext = { params: Promise<{ type: string; id: string }> };
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const type = unitType(params.type);
    const id = positiveId(params.id);
    return adminJson({ ok: true, unit: await getAdminUnit(request, type, id) });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const body = await adminBody(request);
    if (typeof body.name !== "string") throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados da unidade.");
    const unit = await updateAdminUnit(request, unitType(params.type), positiveId(params.id), unitWriteFields(body));
    return adminJson({ ok: true, unit, message: "Unidade atualizada com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { setPlatformTenantStatus } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    if (body.status !== "ATIVO" && body.status !== "SUSPENSO" && body.status !== "CANCELADO") {
      throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
    }
    const tenant = await setPlatformTenantStatus(request, positiveId((await context.params).id), body.status);
    return adminJson({ ok: true, tenant, message: "Status do cliente atualizado." });
  } catch (error) {
    return adminRouteError(error);
  }
}

import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { setPlatformConventionStatus } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    if (body.status !== "ATIVO" && body.status !== "INATIVO") throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
    const convention = await setPlatformConventionStatus(request, positiveId((await context.params).id), body.status);
    return adminJson({ ok: true, convention, message: body.status === "ATIVO" ? "Convenção ativada com sucesso." : "Convenção desativada com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

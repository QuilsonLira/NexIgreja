import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { setAdminUserStatus } from "@/lib/server/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    if (body.status !== "ATIVO" && body.status !== "INATIVO") throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
    const user = await setAdminUserStatus(request, positiveId((await context.params).id), body.status);
    return adminJson({ ok: true, user, message: body.status === "ATIVO" ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

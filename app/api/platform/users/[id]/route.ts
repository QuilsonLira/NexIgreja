import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { permanentlyDeletePlatformUser } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    if (typeof body.password !== "string" || typeof body.confirmation !== "string") {
      throw new ApiError(400, "CONFIRMACAO_INVALIDA", "Informe sua senha e a confirmação digitada.");
    }
    await permanentlyDeletePlatformUser(request, positiveId((await context.params).id), { password: body.password, confirmation: body.confirmation });
    return adminJson({ ok: true, message: "Usuário excluído definitivamente." });
  } catch (error) {
    return adminRouteError(error);
  }
}

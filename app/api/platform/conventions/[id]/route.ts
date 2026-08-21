import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId, unitWriteFields } from "@/lib/admin/http";
import { updatePlatformConvention } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    if (typeof body.name !== "string") throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados da Convenção.");
    const convention = await updatePlatformConvention(request, positiveId((await context.params).id), unitWriteFields(body));
    return adminJson({ ok: true, convention, message: "Convenção atualizada com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

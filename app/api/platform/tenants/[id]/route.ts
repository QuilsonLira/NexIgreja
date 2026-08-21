import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { updatePlatformTenant } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await updatePlatformTenant(request, positiveId((await context.params).id), await adminBody(request));
    return adminJson({ ok: true, tenant, message: "Cliente atualizado com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

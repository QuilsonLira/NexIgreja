import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { enterTenantAdministration } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await enterTenantAdministration(request, positiveId((await context.params).id));
    return adminJson({ ok: true, message: "Contexto administrativo ativado." });
  } catch (error) { return adminRouteError(error); }
}

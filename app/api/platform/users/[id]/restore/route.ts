import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { restorePlatformUser } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await restorePlatformUser(request, positiveId((await context.params).id));
    return adminJson({ ok: true, user, message: "Usuário restaurado com sucesso. Ele permanece inativo até ser reativado." });
  } catch (error) {
    return adminRouteError(error);
  }
}

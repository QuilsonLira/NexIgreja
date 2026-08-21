import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { archivePlatformUser } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await archivePlatformUser(request, positiveId((await context.params).id));
    return adminJson({ ok: true, user, message: "Usuário arquivado com sucesso. O histórico foi preservado." });
  } catch (error) {
    return adminRouteError(error);
  }
}

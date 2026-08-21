import { adminJson, adminRouteError, positiveId, unitType } from "@/lib/admin/http";
import { archivePlatformUnit } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ type: string; id: string }> };
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const unit = await archivePlatformUnit(request, unitType(params.type), positiveId(params.id));
    return adminJson({ ok: true, unit, message: "Unidade arquivada com sucesso. O histórico foi preservado." });
  } catch (error) {
    return adminRouteError(error);
  }
}

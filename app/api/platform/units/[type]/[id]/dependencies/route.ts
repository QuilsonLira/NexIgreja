import { adminJson, adminRouteError, positiveId, unitType } from "@/lib/admin/http";
import { assessPlatformUnitDeletion } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ type: string; id: string }> };
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    return adminJson({ ok: true, assessment: await assessPlatformUnitDeletion(request, unitType(params.type), positiveId(params.id)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

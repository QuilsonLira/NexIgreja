import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { assessPlatformUserDeletion } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  try {
    return adminJson({ ok: true, assessment: await assessPlatformUserDeletion(request, positiveId((await context.params).id)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

import { positiveId } from "@/lib/admin/http";
import { authorizeUnitLogoRead } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/auth";
import { storedImageResponse, unitLogo } from "@/lib/server/media";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  try {
    const id = positiveId((await context.params).id);
    await authorizeUnitLogoRead(request, id);
    return storedImageResponse(await unitLogo(id));
  } catch (error) {
    return errorResponse(error);
  }
}

import { adminJson, adminRouteError, positiveId, unitType } from "@/lib/admin/http";
import { updateAdminUnitLogo } from "@/lib/server/admin";
import { readImageUpload } from "@/lib/server/media";

type RouteContext = { params: Promise<{ type: string; id: string }> };
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const logoUrl = await updateAdminUnitLogo(request, unitType(params.type), positiveId(params.id), () => readImageUpload(request));
    return adminJson({ ok: true, logoUrl, message: "Logo atualizada com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const params = await context.params;
    await updateAdminUnitLogo(request, unitType(params.type), positiveId(params.id), null);
    return adminJson({ ok: true, logoUrl: null, message: "Logo removida com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

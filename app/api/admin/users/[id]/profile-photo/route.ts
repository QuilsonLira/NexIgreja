import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { updateAdminUserPhoto } from "@/lib/server/admin";
import { readImageUpload } from "@/lib/server/media";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext) {
  try {
    const id = positiveId((await context.params).id);
    const profilePhotoUrl = await updateAdminUserPhoto(request, id, () => readImageUpload(request));
    return adminJson({ ok: true, profilePhotoUrl, message: "Foto do usuário atualizada com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const id = positiveId((await context.params).id);
    await updateAdminUserPhoto(request, id, null);
    return adminJson({ ok: true, profilePhotoUrl: null, message: "Foto do usuário removida com sucesso." });
  } catch (error) {
    return adminRouteError(error);
  }
}

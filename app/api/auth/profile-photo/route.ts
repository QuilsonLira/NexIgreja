import { errorResponse } from "@/lib/server/auth";
import { readImageUpload, updateOwnProfilePhoto } from "@/lib/server/media";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const profilePhotoUrl = await updateOwnProfilePhoto(request, () => readImageUpload(request));
    return Response.json({ ok: true, profilePhotoUrl, message: "Foto de perfil atualizada com sucesso." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await updateOwnProfilePhoto(request, null);
    return Response.json({ ok: true, profilePhotoUrl: null, message: "Foto de perfil removida com sucesso." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

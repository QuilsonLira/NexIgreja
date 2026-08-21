import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { assertTrustedOrigin } from "@/lib/server/auth";
import { revokeAdminUserSessions } from "@/lib/server/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const revokedSessions = await revokeAdminUserSessions(request, positiveId((await context.params).id));
    return adminJson({
      ok: true,
      revokedSessions,
      message: revokedSessions ? `${revokedSessions} sessão(ões) encerrada(s) com sucesso.` : "O usuário não possuía sessões ativas.",
    });
  } catch (error) {
    return adminRouteError(error);
  }
}

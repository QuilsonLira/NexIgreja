import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return noStoreJson({ error: { code: "DADOS_INVALIDOS", message: "Usuário inválido." } }, { status: 400 });
    }
    const session = await requireAdminSession(request);
    const revokedSessions = await getAdminService().revokeUserSessions(
      session,
      id,
      getRequestMetadata(request)
    );
    return noStoreJson({
      ok: true,
      revokedSessions,
      message: revokedSessions
        ? `${revokedSessions} sessão(ões) encerrada(s) com sucesso.`
        : "O usuário não possuía sessões ativas."
    });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

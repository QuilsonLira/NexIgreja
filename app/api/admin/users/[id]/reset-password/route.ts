import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { passwordResetSchema } from "@/lib/admin/validation";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const id = Number((await context.params).id);
    const body = passwordResetSchema.safeParse(await request.json());
    if (!Number.isInteger(id) || id <= 0 || !body.success) {
      return noStoreJson({ error: { code: "DADOS_INVALIDOS", message: "Revise a senha temporária." } }, { status: 400 });
    }
    if (body.data.temporaryPassword !== body.data.confirmPassword) {
      return noStoreJson({ error: { code: "SENHAS_DIFERENTES", message: "As senhas não conferem." } }, { status: 400 });
    }
    const session = await requireAdminSession(request);
    await getAdminService().resetUserPassword(
      session,
      id,
      body.data.temporaryPassword,
      getRequestMetadata(request)
    );
    return noStoreJson({
      ok: true,
      message: "Senha temporária definida e sessões anteriores encerradas."
    });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

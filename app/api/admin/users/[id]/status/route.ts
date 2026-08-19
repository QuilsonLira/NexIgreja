import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({ status: z.enum(["ATIVO", "INATIVO"]) });

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const id = Number((await context.params).id);
    const body = schema.safeParse(await request.json());
    if (!Number.isInteger(id) || id <= 0 || !body.success) {
      return noStoreJson({ error: { code: "DADOS_INVALIDOS", message: "Status inválido." } }, { status: 400 });
    }
    const session = await requireAdminSession(request);
    const user = await getAdminService().setUserStatus(
      session,
      id,
      body.data.status,
      getRequestMetadata(request)
    );
    return noStoreJson({
      ok: true,
      user,
      message: body.data.status === "ATIVO" ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso."
    });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

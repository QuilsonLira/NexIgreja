import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { statusWriteSchema, unitTypeSchema } from "@/lib/admin/validation";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

type RouteContext = { params: Promise<{ type: string; id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const params = await context.params;
    const type = unitTypeSchema.safeParse(params.type.toUpperCase());
    const id = Number(params.id);
    const body = statusWriteSchema.safeParse(await request.json());
    if (!type.success || !Number.isInteger(id) || id <= 0 || !body.success) {
      return noStoreJson({ error: { code: "DADOS_INVALIDOS", message: "Status inválido." } }, { status: 400 });
    }
    const session = await requireAdminSession(request);
    const unit = await getAdminService().setUnitStatus(
      session,
      type.data,
      id,
      body.data.status,
      getRequestMetadata(request)
    );
    return noStoreJson({
      ok: true,
      unit,
      message: body.data.status === "ATIVO" ? "Unidade ativada com sucesso." : "Unidade desativada com sucesso."
    });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

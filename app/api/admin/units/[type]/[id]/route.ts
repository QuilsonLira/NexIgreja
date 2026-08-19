import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { unitTypeSchema, unitWriteSchema } from "@/lib/admin/validation";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

type RouteContext = { params: Promise<{ type: string; id: string }> };
export const dynamic = "force-dynamic";

async function parseParams(context: RouteContext) {
  const params = await context.params;
  const type = unitTypeSchema.safeParse(params.type.toUpperCase());
  const id = Number(params.id);
  return type.success && Number.isInteger(id) && id > 0 ? { type: type.data, id } : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const parsedParams = await parseParams(context);
    if (!parsedParams) {
      return noStoreJson({ error: { code: "ROTA_INVALIDA", message: "Unidade inválida." } }, { status: 400 });
    }
    const session = await requireAdminSession(request);
    const unit = await getAdminService().getUnit(session, parsedParams.type, parsedParams.id);
    return noStoreJson({ ok: true, unit });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const parsedParams = await parseParams(context);
    const body = unitWriteSchema.omit({ type: true }).safeParse(await request.json());
    if (!parsedParams || !body.success) {
      return noStoreJson(
        { error: { code: "DADOS_INVALIDOS", message: "Revise os dados da unidade." } },
        { status: 400 }
      );
    }
    const session = await requireAdminSession(request);
    const unit = await getAdminService().updateUnit(
      session,
      parsedParams.type,
      parsedParams.id,
      body.data,
      getRequestMetadata(request)
    );
    return noStoreJson({ ok: true, unit, message: "Unidade atualizada com sucesso." });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import {
  accountStatusSchema,
  optionalEnum,
  organizationalScopeSchema,
  positiveInteger,
  safeSearch,
  userWriteSchema
} from "@/lib/admin/validation";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    const params = request.nextUrl.searchParams;
    const result = await getAdminService().listUsers(session, {
      search: safeSearch(params.get("search")),
      scope: optionalEnum(params.get("scope"), organizationalScopeSchema.options),
      status: optionalEnum(params.get("status"), accountStatusSchema.options),
      page: positiveInteger(params.get("page"), 1),
      pageSize: positiveInteger(params.get("pageSize"), 10, 50)
    });
    return noStoreJson({ ok: true, result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const body = userWriteSchema.extend({
      cpf: userWriteSchema.shape.cpf.unwrap(),
      temporaryPassword: userWriteSchema.shape.temporaryPassword.unwrap()
    }).safeParse(await request.json());
    if (!body.success) {
      return noStoreJson(
        { error: { code: "DADOS_INVALIDOS", message: "Revise os dados do usuário." } },
        { status: 400 }
      );
    }
    const session = await requireAdminSession(request);
    const user = await getAdminService().createUser(session, body.data, getRequestMetadata(request));
    return noStoreJson({ ok: true, user, message: "Usuário cadastrado com sucesso." }, { status: 201 });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

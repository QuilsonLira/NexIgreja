import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import {
  optionalEnum,
  positiveInteger,
  safeSearch,
  unitStatusSchema,
  unitTypeSchema,
  unitWriteSchema
} from "@/lib/admin/validation";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    const params = request.nextUrl.searchParams;
    const result = await getAdminService().listUnits(session, {
      search: safeSearch(params.get("search")),
      type: optionalEnum(params.get("type"), unitTypeSchema.options),
      status: optionalEnum(params.get("status"), unitStatusSchema.options),
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
    const session = await requireAdminSession(request);
    const parsed = unitWriteSchema.extend({ type: unitTypeSchema }).safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        { error: { code: "DADOS_INVALIDOS", message: "Revise os dados da unidade." } },
        { status: 400 }
      );
    }
    const unit = await getAdminService().createUnit(session, parsed.data, getRequestMetadata(request));
    return noStoreJson({ ok: true, unit, message: "Unidade cadastrada com sucesso." }, { status: 201 });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson(
        { error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } },
        { status: 403 }
      );
    }
    return adminErrorResponse(error);
  }
}

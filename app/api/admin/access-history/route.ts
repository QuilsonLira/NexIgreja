import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import {
  accessResultSchema,
  identifierTypeSchema,
  optionalEnum,
  positiveInteger,
  safeDate,
  safeSearch
} from "@/lib/admin/validation";
import { noStoreJson } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    const params = request.nextUrl.searchParams;
    const result = await getAdminService().listAccessHistory(session, {
      search: safeSearch(params.get("search")),
      result: optionalEnum(params.get("result"), accessResultSchema.options),
      identifierType: optionalEnum(params.get("identifierType"), identifierTypeSchema.options),
      dateFrom: safeDate(params.get("dateFrom")),
      dateTo: safeDate(params.get("dateTo")),
      page: positiveInteger(params.get("page"), 1),
      pageSize: positiveInteger(params.get("pageSize"), 10, 50)
    });
    return noStoreJson({ ok: true, result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

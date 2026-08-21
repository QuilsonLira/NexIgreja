import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, unitWriteFields } from "@/lib/admin/http";
import { createAdminUnit, listAdminUnits } from "@/lib/server/admin";
import type { AdminUnitType } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = await listAdminUnits(request, Object.fromEntries(params));
    return adminJson({ ok: true, result });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await adminBody(request);
    if (typeof body.name !== "string" || typeof body.type !== "string") throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados da unidade.");
    const unit = await createAdminUnit(request, { type: body.type.toUpperCase() as AdminUnitType, ...unitWriteFields(body) });
    return adminJson({ ok: true, unit, message: "Unidade cadastrada com sucesso." }, 201);
  } catch (error) {
    return adminRouteError(error);
  }
}

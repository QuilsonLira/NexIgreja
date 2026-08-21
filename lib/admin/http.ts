import { ApiError, assertTrustedOrigin, errorResponse } from "@/lib/server/auth";
import type { AdminUnitType, UnitWriteInput } from "@/lib/admin/types";

export function adminJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function adminBody(request: Request): Promise<Record<string, unknown>> {
  assertTrustedOrigin(request);
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados enviados.");
  }
}

export function adminRouteError(error: unknown): Response {
  return errorResponse(error);
}

export function unitType(value: string): AdminUnitType {
  const normalized = value.toUpperCase();
  if (normalized !== "CONVENCAO" && normalized !== "MATRIZ" && normalized !== "FILIAL") {
    throw new ApiError(400, "DADOS_INVALIDOS", "Unidade inválida.");
  }
  return normalized;
}

export function positiveId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "DADOS_INVALIDOS", "Registro inválido.");
  return id;
}

export function unitWriteFields(body: Record<string, unknown>): Omit<UnitWriteInput, "type"> {
  if (typeof body.name !== "string") throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados da unidade.");
  const optional = (key: string): string | null => typeof body[key] === "string" ? body[key] as string : null;
  return {
    tenantId: body.tenantId === null || body.tenantId === undefined ? null : Number(body.tenantId),
    name: body.name,
    fantasyName: optional("fantasyName"),
    legalName: optional("legalName"),
    cnpj: optional("cnpj"),
    usesParentCnpj: body.usesParentCnpj === true,
    phone: optional("phone"),
    whatsapp: optional("whatsapp"),
    email: optional("email"),
    postalCode: optional("postalCode"),
    street: optional("street"),
    number: optional("number"),
    complement: optional("complement"),
    district: optional("district"),
    city: optional("city"),
    state: optional("state"),
    responsibleName: optional("responsibleName"),
    foundationDate: optional("foundationDate"),
    notes: optional("notes"),
    matrixId: body.matrixId === null || body.matrixId === undefined ? null : Number(body.matrixId),
  };
}

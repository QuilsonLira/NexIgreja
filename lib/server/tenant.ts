import type { TenantStatus, TenantSummary } from "@/lib/types";
import { ApiError, database } from "@/lib/server/auth";
import { isTenantOperational, sameTenant } from "@/lib/tenant/policy";

export async function tenantById(id: number): Promise<TenantSummary | null> {
  return database().prepare("SELECT id, name, slug, status FROM tenants WHERE id = ? LIMIT 1").bind(id).first<TenantSummary>();
}

export async function tenantForUnit(unitId: number): Promise<TenantSummary | null> {
  return database().prepare("SELECT tenant.id, tenant.name, tenant.slug, tenant.status FROM organizational_units unit JOIN tenants tenant ON tenant.id = unit.tenant_id WHERE unit.id = ? LIMIT 1").bind(unitId).first<TenantSummary>();
}

export function assertTenantOperational(status: TenantStatus): void {
  if (!isTenantOperational(status)) throw new ApiError(403, "TENANT_INDISPONIVEL", "A organização está suspensa ou cancelada. Procure o responsável pela plataforma.");
}

export function assertSameTenant(authenticatedTenantId: number, resourceTenantId: number): void {
  if (!sameTenant(authenticatedTenantId, resourceTenantId)) throw new ApiError(404, "REGISTRO_NAO_ENCONTRADO", "Registro não encontrado.");
}

import type { TenantStatus } from "@/lib/types";

export function isTenantOperational(status: TenantStatus): boolean {
  return status === "ATIVO";
}

export function sameTenant(authenticatedTenantId: number, resourceTenantId: number): boolean {
  return authenticatedTenantId === resourceTenantId;
}

export function tenantAccessStatus(authenticatedTenantId: number, resourceTenantId: number): 200 | 404 {
  return sameTenant(authenticatedTenantId, resourceTenantId) ? 200 : 404;
}

export function normalizeTenantSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

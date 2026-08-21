export type InstitutionStatus = "ATIVO" | "SUSPENSO" | "CANCELADO";

export function isInstitutionCode(value: string): boolean {
  return /^\d{7}$/.test(value.trim());
}

export function isInstitutionAvailable(status: InstitutionStatus | null | undefined): boolean {
  return status === "ATIVO";
}

export function loginIsolationNamespace(mode: "ORGANIZATIONAL" | "PLATFORM", tenantId: number | null): string {
  if (mode === "PLATFORM") return "PLATFORM";
  if (!Number.isInteger(tenantId) || Number(tenantId) <= 0) throw new Error("tenant context is required");
  return `TENANT:${tenantId}`;
}

export type CnpjUnitType = "CONVENCAO" | "MATRIZ" | "FILIAL";

export function canInheritCnpj(type: CnpjUnitType, parentCnpj: string | null): boolean {
  return type === "FILIAL" && Boolean(parentCnpj);
}

export function effectiveCnpj(input: { type: CnpjUnitType; ownCnpj: string | null; parentCnpj: string | null; usesParentCnpj: boolean }): string | null {
  return input.type === "FILIAL" && input.usesParentCnpj ? input.parentCnpj : input.ownCnpj;
}

export function conflictsWithOwnCnpj(existing: { tenantId: number; ownCnpj: string | null; usesParentCnpj: boolean }, candidate: { tenantId: number; ownCnpj: string | null }): boolean {
  return Boolean(candidate.ownCnpj && existing.tenantId === candidate.tenantId && !existing.usesParentCnpj && existing.ownCnpj === candidate.ownCnpj);
}

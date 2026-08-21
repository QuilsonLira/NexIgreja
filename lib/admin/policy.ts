import type { ActiveContext, AdministrativeActor, OrganizationalScope } from "@/lib/types";
import type { UnitRecord } from "@/lib/admin/types";

export interface UserScopeTarget {
  tenantId: number;
  conventionId: number;
  scope: OrganizationalScope;
  boundMatrixId: number | null;
  boundBranchId: number | null;
  branchMatrixId: number | null;
}

export function canAdministerUnit(actor: AdministrativeActor, unit: UnitRecord): boolean {
  if (unit.tenantId !== actor.tenantId) return false;
  if (unit.conventionId !== actor.conventionId) return false;
  if (actor.scope === "CONVENCAO") return true;
  if (actor.scope === "MATRIZ") {
    return unit.type === "MATRIZ"
      ? unit.id === actor.boundMatrixId
      : unit.type === "FILIAL" && unit.matrixId === actor.boundMatrixId;
  }
  return unit.type === "FILIAL" && unit.id === actor.boundBranchId;
}

export function canReadUnitLogo(actor: AdministrativeActor, activeContext: ActiveContext | null, unit: UnitRecord): boolean {
  if (unit.tenantId !== actor.tenantId) return false;
  if (unit.conventionId !== actor.conventionId) return false;
  if (actor.scope === "CONVENCAO" || canAdministerUnit(actor, unit)) return true;
  if (unit.type === "CONVENCAO" && unit.id === actor.conventionId) return true;
  return unit.id === activeContext?.matrixId || unit.id === activeContext?.branchId;
}

export function canAdministerUser(actor: AdministrativeActor, target: UserScopeTarget): boolean {
  if (target.tenantId !== actor.tenantId) return false;
  if (target.conventionId !== actor.conventionId) return false;
  if (actor.scope === "CONVENCAO") return true;
  if (actor.scope === "MATRIZ") {
    return (target.scope === "MATRIZ" && target.boundMatrixId === actor.boundMatrixId)
      || (target.scope === "FILIAL" && target.branchMatrixId === actor.boundMatrixId);
  }
  return target.scope === "FILIAL" && target.boundBranchId === actor.boundBranchId;
}

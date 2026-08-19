import type { OrganizationalUser } from "@/lib/auth/types";
import type { UnitRecord, UserRecord } from "@/lib/admin/types";

export function canAdministerUnit(actor: OrganizationalUser, unit: UnitRecord): boolean {
  if (unit.conventionId !== actor.conventionId) return false;

  if (actor.scope === "CONVENCAO") return true;

  if (actor.scope === "MATRIZ") {
    if (actor.boundMatrixId === null) return false;
    if (unit.type === "MATRIZ") return unit.id === actor.boundMatrixId;
    if (unit.type === "FILIAL") return unit.matrixId === actor.boundMatrixId;
    return false;
  }

  return unit.type === "FILIAL" && actor.boundBranchId !== null && unit.id === actor.boundBranchId;
}

export function canAdministerUser(actor: OrganizationalUser, user: UserRecord): boolean {
  if (user.conventionId !== actor.conventionId) return false;

  if (actor.scope === "CONVENCAO") return true;

  if (actor.scope === "MATRIZ") {
    if (actor.boundMatrixId === null) return false;
    if (user.scope === "MATRIZ") return user.boundMatrixId === actor.boundMatrixId;
    if (user.scope === "FILIAL") return user.branchMatrixId === actor.boundMatrixId;
    return false;
  }

  return (
    user.scope === "FILIAL" &&
    actor.boundBranchId !== null &&
    user.boundBranchId === actor.boundBranchId
  );
}

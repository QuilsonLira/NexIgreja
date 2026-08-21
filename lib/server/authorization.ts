import type { OrganizationalScope } from "@/lib/types";

type UnitType = "CONVENCAO" | "MATRIZ" | "FILIAL";

export interface UnitAuthorizationInput {
  scope: OrganizationalScope;
  scopeUnitId: number;
  scopeUnitType: UnitType;
  target: {
    id: number;
    type: UnitType;
    status: string;
    parentId: number | null;
    parentStatus: string | null;
    grandparentId: number | null;
    grandparentStatus: string | null;
  };
}

export function isUnitWithinScope(input: UnitAuthorizationInput): boolean {
  const { scope, scopeUnitId, scopeUnitType, target } = input;
  if (target.status !== "ATIVO") return false;
  if (target.type === "MATRIZ" && target.parentStatus !== "ATIVO") return false;
  if (target.type === "FILIAL" && (target.parentStatus !== "ATIVO" || target.grandparentStatus !== "ATIVO")) return false;

  if (scope === "CONVENCAO") {
    return scopeUnitType === "CONVENCAO" && (
      (target.type === "MATRIZ" && target.parentId === scopeUnitId) ||
      (target.type === "FILIAL" && target.grandparentId === scopeUnitId)
    );
  }
  if (scope === "MATRIZ") {
    return scopeUnitType === "MATRIZ" && (
      (target.type === "MATRIZ" && target.id === scopeUnitId) ||
      (target.type === "FILIAL" && target.parentId === scopeUnitId)
    );
  }
  return scopeUnitType === "FILIAL" && target.type === "FILIAL" && target.id === scopeUnitId;
}

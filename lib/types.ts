export type IdentifierType = "CPF" | "USUARIO" | "EMAIL";
export type OrganizationalScope = "CONVENCAO" | "MATRIZ" | "FILIAL";
export type AccountStatus = "ATIVO" | "INATIVO" | "PENDENTE" | "BLOQUEADO";
export type TenantStatus = "ATIVO" | "SUSPENSO" | "CANCELADO";
import type { LicenseSummary } from "@/lib/billing/types";

export interface TenantSummary {
  id: number;
  name: string;
  slug: string;
  status: TenantStatus;
}

export interface InstitutionContext {
  id: number;
  name: string;
}

export interface OrganizationOption extends TenantSummary {
  membershipId: number;
  membershipStatus: "ATIVO" | "PENDENTE";
  roleName: string;
}

export interface ActiveContext {
  unitId?: number;
  matrixId: number;
  branchId: number | null;
  unitName: string;
  unitType: "CONVENCAO" | "MATRIZ" | "FILIAL";
}

export interface LastAccess {
  dateTime: string;
  identifierType: IdentifierType;
  originSummary: string | null;
}

export interface SafeSessionPayload {
  user: {
    id: number;
    membershipId: number | null;
    name: string;
    username: string;
    roleName: string;
    status: "ATIVO";
    organizationalScope: OrganizationalScope;
    mustChangePassword: boolean;
    profilePhotoUrl: string | null;
    isPlatformOwner: boolean;
    platformTenantContextActive: boolean;
  };
  binding: { matrixId: number | null; branchId: number | null };
  activeContext: ActiveContext | null;
  unitLogoUrl: string | null;
  activeConvention: { id: number; name: string } | null;
  activeTenant: TenantSummary | null;
  lastPreviousAccess: LastAccess | null;
  license: LicenseSummary | null;
}

export interface AvailableContexts {
  tenants: TenantSummary[];
  conventions: Array<{ id: number; name: string; tenantId?: number; tenantName?: string }>;
  fixedMatrixId: number | null;
  matrices: Array<{ id: number; name: string }>;
  branches: Array<{ id: number; matrixId: number; name: string }>;
  canChangeMatrix: boolean;
  canChangeBranch: boolean;
  canChangeConvention: boolean;
}

export interface AdministrativeActor {
  id: number;
  membershipId: number | null;
  name: string;
  conventionId: number;
  tenantId: number;
  tenantStatus: TenantStatus;
  scope: OrganizationalScope;
  boundMatrixId: number | null;
  boundBranchId: number | null;
  mustChangePassword: boolean;
  isPlatformOwner: boolean;
  platformTenantContextActive?: boolean;
}

export interface AdministrativeSession {
  sessionId: string;
  user: AdministrativeActor;
  activeContext: ActiveContext | null;
}

export interface PlatformOwnerSession {
  sessionId: string;
  user: {
    id: number;
    name: string;
    mustChangePassword: boolean;
    isPlatformOwner: boolean;
  };
}

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
  deviceSummary: string | null;
}

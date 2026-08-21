import type { AccountStatus, IdentifierType, OrganizationalScope, TenantStatus } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";

export type AdminUnitType = "CONVENCAO" | "MATRIZ" | "FILIAL";
export type AdminUnitStatus = "ATIVO" | "INATIVO";
export type AccessResult = "SUCESSO" | "FALHA" | "SEGURANCA";

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UnitRecord {
  id: number;
  tenantId: number;
  type: AdminUnitType;
  name: string;
  fantasyName: string | null;
  legalName: string | null;
  cnpj: string | null;
  ownCnpj?: string | null;
  parentCnpj?: string | null;
  usesParentCnpj?: boolean;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  responsibleName: string | null;
  foundationDate: string | null;
  notes: string | null;
  status: AdminUnitStatus;
  conventionId: number;
  conventionName: string;
  matrixId: number | null;
  matrixName: string | null;
  parentName: string | null;
  logoUrl: string | null;
  archivedAt: string | null;
  archivedBy: number | null;
  archivedByName: string | null;
  archivedPreviousStatus: AdminUnitStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnitOption { id: number; name: string; status: AdminUnitStatus; cnpj?: string | null }
export interface AdminUnitOptions {
  convention: UnitOption;
  matrices: UnitOption[];
  branches: Array<UnitOption & { matrixId: number }>;
}

export interface UserRecord {
  id: number;
  identityId: number;
  tenantId: number;
  conventionId: number;
  name: string;
  username: string;
  email: string;
  cpf: string;
  cpfHint: string;
  roleName: string;
  functionId?: number | null;
  scope: OrganizationalScope;
  status: AccountStatus;
  mustChangePassword: boolean;
  boundMatrixId: number | null;
  boundBranchId: number | null;
  branchMatrixId: number | null;
  matrixName: string | null;
  branchName: string | null;
  permissions: PermissionCode[];
  activeSessions: number;
  lastLoginAt: string | null;
  profilePhotoUrl: string | null;
  archivedAt: string | null;
  archivedBy: number | null;
  archivedByName: string | null;
  archivedPreviousStatus: "ATIVO" | "INATIVO" | "PENDENTE" | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeletionDependency {
  source: string;
  label: string;
  count: number;
}

export interface DeletionAssessment {
  canDelete: boolean;
  dependencies: DeletionDependency[];
  summary: string;
}

export interface AccessHistoryRecord {
  id: number;
  userId: number | null;
  userName: string;
  username: string | null;
  event: string;
  result: AccessResult;
  identifierType: IdentifierType | null;
  originSummary: string;
  ipAddress: string | null;
  unitName: string | null;
  occurredAt: string;
}

export interface AdminBootstrap {
  isPlatformOwner: boolean;
  permissions: PermissionCode[];
  permissionDefinitions: Array<{ code: PermissionCode; label: string; group: string }>;
  unitOptions: AdminUnitOptions;
  allowedUserScopes: OrganizationalScope[];
  creatableUnitTypes: AdminUnitType[];
  functionOptions: Array<{ id: number; name: string }>;
}

export interface UnitWriteInput {
  tenantId?: number | null;
  type?: AdminUnitType;
  name: string;
  fantasyName?: string | null;
  legalName?: string | null;
  cnpj?: string | null;
  usesParentCnpj?: boolean;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  responsibleName?: string | null;
  foundationDate?: string | null;
  notes?: string | null;
  matrixId?: number | null;
}

export interface TenantRecord {
  id: number;
  name: string;
  slug: string;
  accessCode: string;
  status: TenantStatus;
  conventionCount: number;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}
export interface UserWriteInput {
  name: string;
  username: string;
  email: string;
  cpf?: string;
  roleName?: string;
  functionId?: number | null;
  scope: OrganizationalScope;
  matrixId?: number | null;
  branchId?: number | null;
  temporaryPassword?: string;
  permissions: PermissionCode[];
}

export interface OrganizationalFunctionRecord {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  status: AdminUnitStatus;
  membershipCount: number;
  createdAt: string;
  updatedAt: string;
}

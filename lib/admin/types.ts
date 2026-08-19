import type {
  AccountStatus,
  IdentifierType,
  OrganizationalScope,
  OrganizationalUser,
  RequestMetadata
} from "@/lib/auth/types";
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
  type: AdminUnitType;
  name: string;
  status: AdminUnitStatus;
  conventionId: number;
  conventionName: string;
  matrixId: number | null;
  matrixName: string | null;
  parentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UnitOption {
  id: number;
  name: string;
  status: AdminUnitStatus;
}

export interface AdminUnitOptions {
  convention: UnitOption;
  matrices: UnitOption[];
  branches: Array<UnitOption & { matrixId: number }>;
}

export interface UserRecord extends OrganizationalUser {
  name: string;
  username: string;
  email: string;
  cpfHint: string;
  roleName: string;
  status: AccountStatus;
  branchMatrixId: number | null;
  matrixName: string | null;
  branchName: string | null;
  permissions: PermissionCode[];
  activeSessions: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface UnitListQuery {
  search: string;
  type: AdminUnitType | null;
  status: AdminUnitStatus | null;
  page: number;
  pageSize: number;
}

export interface UserListQuery {
  search: string;
  scope: OrganizationalScope | null;
  status: AccountStatus | null;
  page: number;
  pageSize: number;
}

export interface AccessListQuery {
  search: string;
  result: AccessResult | null;
  identifierType: IdentifierType | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

export interface PersistedUserInput {
  conventionId: number;
  name: string;
  username: string;
  email: string;
  cpfLookupHash?: string;
  cpfLastDigits?: string;
  passwordHash?: string;
  roleName: string;
  scope: OrganizationalScope;
  matrixId: number | null;
  branchId: number | null;
  permissions: PermissionCode[];
}

export interface UserWriteInput {
  name: string;
  username: string;
  email: string;
  cpf?: string;
  roleName: string;
  scope: OrganizationalScope;
  matrixId?: number | null;
  branchId?: number | null;
  temporaryPassword?: string;
  permissions: PermissionCode[];
}

export interface AdministrationAuditInput {
  actorUserId: number;
  conventionId: number;
  action: string;
  entityType: string;
  entityId: number;
  matrixId?: number | null;
  branchId?: number | null;
  details?: Record<string, unknown> | null;
  metadata: RequestMetadata;
}

export interface AdminBootstrap {
  permissions: PermissionCode[];
  permissionDefinitions: Array<{ code: PermissionCode; label: string; group: string }>;
  unitOptions: AdminUnitOptions;
  allowedUserScopes: OrganizationalScope[];
  creatableUnitTypes: AdminUnitType[];
}

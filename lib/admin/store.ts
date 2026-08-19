import type { AuthenticatedSession, RequestMetadata } from "@/lib/auth/types";
import type { PermissionCode } from "@/lib/admin/permissions";
import type {
  AccessHistoryRecord,
  AccessListQuery,
  AdminUnitOptions,
  AdminUnitStatus,
  AdminUnitType,
  PageResult,
  PersistedUserInput,
  UnitListQuery,
  UnitRecord,
  UserListQuery,
  UserRecord
} from "@/lib/admin/types";

export class AdminStoreConflictError extends Error {
  constructor(public readonly field: "username" | "email" | "cpf" | "unitName") {
    super("Registro duplicado");
    this.name = "AdminStoreConflictError";
  }
}

export interface AdminStore {
  listPermissions(userId: number): Promise<PermissionCode[]>;
  listUnitOptions(actor: AuthenticatedSession["user"]): Promise<AdminUnitOptions>;
  listUnits(actor: AuthenticatedSession["user"], query: UnitListQuery): Promise<PageResult<UnitRecord>>;
  getUnit(type: AdminUnitType, id: number): Promise<UnitRecord | null>;
  createMatrix(
    actor: AuthenticatedSession["user"],
    conventionId: number,
    name: string,
    metadata: RequestMetadata
  ): Promise<UnitRecord>;
  createBranch(
    actor: AuthenticatedSession["user"],
    matrixId: number,
    name: string,
    metadata: RequestMetadata
  ): Promise<UnitRecord>;
  updateUnit(
    actor: AuthenticatedSession["user"],
    unit: UnitRecord,
    name: string,
    matrixId: number | null,
    metadata: RequestMetadata
  ): Promise<UnitRecord>;
  setUnitStatus(
    actor: AuthenticatedSession["user"],
    unit: UnitRecord,
    status: AdminUnitStatus,
    metadata: RequestMetadata
  ): Promise<UnitRecord>;
  listUsers(actor: AuthenticatedSession["user"], query: UserListQuery): Promise<PageResult<UserRecord>>;
  getUser(id: number): Promise<UserRecord | null>;
  createUser(
    actor: AuthenticatedSession["user"],
    input: Required<Pick<PersistedUserInput, "cpfLookupHash" | "cpfLastDigits" | "passwordHash">> & PersistedUserInput,
    metadata: RequestMetadata
  ): Promise<UserRecord>;
  updateUser(
    actor: AuthenticatedSession["user"],
    target: UserRecord,
    input: PersistedUserInput,
    metadata: RequestMetadata
  ): Promise<UserRecord>;
  setUserStatus(
    actor: AuthenticatedSession["user"],
    target: UserRecord,
    status: "ATIVO" | "INATIVO",
    metadata: RequestMetadata
  ): Promise<UserRecord>;
  resetUserPassword(
    actor: AuthenticatedSession["user"],
    target: UserRecord,
    passwordHash: string,
    metadata: RequestMetadata
  ): Promise<void>;
  revokeUserSessions(
    actor: AuthenticatedSession["user"],
    target: UserRecord,
    metadata: RequestMetadata
  ): Promise<number>;
  listAccessHistory(
    actor: AuthenticatedSession["user"],
    query: AccessListQuery
  ): Promise<PageResult<AccessHistoryRecord>>;
}

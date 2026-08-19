export type IdentifierType = "CPF" | "USUARIO" | "EMAIL";
export type AccountStatus = "ATIVO" | "INATIVO" | "EX_USUARIO" | "BLOQUEADO";
export type OrganizationalScope = "CONVENCAO" | "MATRIZ" | "FILIAL";
export type UnitType = "MATRIZ" | "FILIAL";

export type AuditEvent =
  | "LOGIN_SUCESSO"
  | "LOGIN_RECUSADO"
  | "BLOQUEIO_TEMPORARIO"
  | "LOGOUT"
  | "TROCA_SENHA"
  | "REDEFINICAO_SENHA"
  | "TROCA_CONTEXTO"
  | "ACESSO_FORA_ESCOPO"
  | "SESSAO_REVOGADA";

export interface ClassifiedIdentifier {
  type: IdentifierType;
  normalized: string;
  lookupValue: string;
  safeHint: string;
}

export interface OrganizationalUser {
  id: number;
  conventionId: number;
  scope: OrganizationalScope;
  boundMatrixId: number | null;
  boundBranchId: number | null;
}

export interface ConventionRecord {
  id: number;
  name: string;
  status: "ATIVO" | "INATIVO";
}

export interface LoginUser extends OrganizationalUser {
  name: string;
  username: string;
  roleName: string;
  status: AccountStatus;
  passwordHash: string;
  failedAttempts: number;
  blockedUntil: Date | null;
  sessionVersion: number;
  mustChangePassword: boolean;
}

export interface MatrixRecord {
  id: number;
  conventionId: number;
  name: string;
  status: "ATIVO" | "INATIVO";
}

export interface BranchRecord {
  id: number;
  matrixId: number;
  name: string;
  status: "ATIVO" | "INATIVO";
}

export interface ActiveContext {
  matrixId: number;
  branchId: number | null;
  unitName: string;
  unitType: UnitType;
}

export interface AvailableContexts {
  fixedMatrixId: number | null;
  matrices: Array<{ id: number; name: string }>;
  branches: Array<{ id: number; matrixId: number; name: string }>;
  canChangeMatrix: boolean;
  canChangeBranch: boolean;
}

export interface LastAccess {
  dateTime: string;
  identifierType: IdentifierType;
  originSummary: string | null;
}

export interface RequestMetadata {
  ipHash: string;
  ipAddress?: string | null;
  originSummary: string;
  userAgent: string;
}

export interface SafeSessionPayload {
  user: {
    id: number;
    name: string;
    username: string;
    roleName: string;
    status: "ATIVO";
    organizationalScope: OrganizationalScope;
    mustChangePassword: boolean;
  };
  binding: {
    matrixId: number | null;
    branchId: number | null;
  };
  activeContext: ActiveContext | null;
  lastPreviousAccess: LastAccess | null;
}

export interface AuthenticatedSession {
  sessionId: string;
  user: LoginUser;
  activeContext: ActiveContext | null;
  lastPreviousAccess: LastAccess | null;
  expiresAt: Date;
}

export interface AuditInput {
  userId: number | null;
  conventionId: number | null;
  event: AuditEvent;
  identifierType?: IdentifierType | null;
  protectedIdentifier?: string | null;
  internalReason: string;
  metadata: RequestMetadata;
  matrixId?: number | null;
  branchId?: number | null;
}

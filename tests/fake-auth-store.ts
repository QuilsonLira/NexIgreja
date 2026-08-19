import type {
  CompleteLoginInput,
  CompleteLoginResult,
  AuthStore,
  RejectedAttemptInput,
  RejectedAttemptResult,
  ThrottleState
} from "@/lib/auth/store";
import type {
  ActiveContext,
  AuditInput,
  AuthenticatedSession,
  BranchRecord,
  ClassifiedIdentifier,
  ConventionRecord,
  LastAccess,
  LoginUser,
  MatrixRecord,
  RequestMetadata
} from "@/lib/auth/types";

export interface FakeUser extends LoginUser {
  testCpf: string;
  testEmail: string;
}

export class FakeAuthStore implements AuthStore {
  users: FakeUser[] = [];
  conventions: ConventionRecord[] = [];
  matrices: MatrixRecord[] = [];
  branches: BranchRecord[] = [];
  audits: AuditInput[] = [];
  throttles = new Map<string, ThrottleState>();
  sessions = new Map<string, AuthenticatedSession>();
  lastAccessByUser = new Map<number, LastAccess>();
  lookupTypes: ClassifiedIdentifier["type"][] = [];

  async findUserByCredential(identifier: ClassifiedIdentifier): Promise<LoginUser | null> {
    this.lookupTypes.push(identifier.type);
    const found = this.users.find((user) => {
      if (identifier.type === "CPF") return user.testCpf === identifier.normalized;
      if (identifier.type === "EMAIL") return user.testEmail === identifier.normalized;
      return user.username === identifier.normalized;
    });
    return found ?? null;
  }

  async getThrottle(rateKeyHash: string): Promise<ThrottleState | null> {
    return this.throttles.get(rateKeyHash) ?? null;
  }

  async recordRejectedAttempt(input: RejectedAttemptInput): Promise<RejectedAttemptResult> {
    const previous = this.throttles.get(input.rateKeyHash)?.failedAttempts ?? 0;
    const failedAttempts = previous + 1;
    const blockedUntil =
      failedAttempts >= input.maxAttempts ? new Date(Date.now() + input.blockMinutes * 60_000) : null;
    this.throttles.set(input.rateKeyHash, { failedAttempts, blockedUntil });

    if (input.user && input.incrementUserCounter) {
      input.user.failedAttempts += 1;
      if (input.user.failedAttempts >= input.maxAttempts) input.user.blockedUntil = blockedUntil;
    }

    this.audits.push({
      userId: input.user?.id ?? null,
      conventionId: input.user?.conventionId ?? null,
      event: blockedUntil ? "BLOQUEIO_TEMPORARIO" : "LOGIN_RECUSADO",
      identifierType: input.identifierType,
      protectedIdentifier: input.protectedIdentifier,
      internalReason: input.internalReason,
      metadata: input.metadata
    });
    return { blockedUntil };
  }

  async completeLogin(input: CompleteLoginInput): Promise<CompleteLoginResult> {
    input.user.failedAttempts = 0;
    input.user.blockedUntil = null;
    this.throttles.delete(input.rateKeyHash);
    const lastPreviousAccess = this.lastAccessByUser.get(input.user.id) ?? null;

    this.sessions.set(input.sessionTokenHash, {
      sessionId: input.sessionId,
      user: input.user,
      activeContext: input.initialContext,
      lastPreviousAccess,
      expiresAt: input.expiresAt
    });
    this.audits.push({
      userId: input.user.id,
      conventionId: input.user.conventionId,
      event: "LOGIN_SUCESSO",
      identifierType: input.identifierType,
      protectedIdentifier: input.protectedIdentifier,
      internalReason: "CREDENCIAIS_VALIDAS",
      metadata: input.metadata,
      matrixId: input.initialContext?.matrixId ?? null,
      branchId: input.initialContext?.branchId ?? null
    });
    this.lastAccessByUser.set(input.user.id, {
      dateTime: new Date().toISOString(),
      identifierType: input.identifierType,
      originSummary: input.metadata.originSummary
    });
    return { lastPreviousAccess };
  }

  async findSession(sessionTokenHash: string): Promise<AuthenticatedSession | null> {
    return this.sessions.get(sessionTokenHash) ?? null;
  }

  async touchSession(): Promise<void> {}

  async updateSessionContext(sessionId: string, context: ActiveContext): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.sessionId === sessionId) session.activeContext = context;
    }
  }

  async revokeSession(
    sessionId: string,
    user: LoginUser,
    reason: string,
    metadata: RequestMetadata
  ): Promise<void> {
    for (const [token, session] of this.sessions.entries()) {
      if (session.sessionId === sessionId) this.sessions.delete(token);
    }
    this.audits.push({
      userId: user.id,
      conventionId: user.conventionId,
      event: reason === "LOGOUT" ? "LOGOUT" : "SESSAO_REVOGADA",
      internalReason: reason,
      metadata
    });
  }

  async changePasswordAndRevokeSessions(
    user: LoginUser,
    newPasswordHash: string,
    metadata: RequestMetadata
  ): Promise<void> {
    user.passwordHash = newPasswordHash;
    user.sessionVersion += 1;
    user.mustChangePassword = false;
    this.sessions.clear();
    this.audits.push({
      userId: user.id,
      conventionId: user.conventionId,
      event: "TROCA_SENHA",
      internalReason: "SENHA_ALTERADA_PELO_USUARIO",
      metadata
    });
    this.audits.push({
      userId: user.id,
      conventionId: user.conventionId,
      event: "SESSAO_REVOGADA",
      internalReason: "TODAS_AS_SESSOES_REVOGADAS_APOS_TROCA_SENHA",
      metadata
    });
  }

  async recordAudit(input: AuditInput): Promise<void> {
    this.audits.push(input);
  }

  async getConventionById(conventionId: number): Promise<ConventionRecord | null> {
    return this.conventions.find((convention) => convention.id === conventionId) ?? null;
  }

  async getMatrixById(matrixId: number): Promise<MatrixRecord | null> {
    return this.matrices.find((matrix) => matrix.id === matrixId) ?? null;
  }

  async getBranchById(branchId: number): Promise<BranchRecord | null> {
    return this.branches.find((branch) => branch.id === branchId) ?? null;
  }

  async listActiveMatrices(conventionId: number): Promise<MatrixRecord[]> {
    return this.matrices.filter(
      (matrix) => matrix.conventionId === conventionId && matrix.status === "ATIVO"
    );
  }

  async listActiveBranches(matrixIds: number[]): Promise<BranchRecord[]> {
    return this.branches.filter(
      (branch) => matrixIds.includes(branch.matrixId) && branch.status === "ATIVO"
    );
  }
}

import { randomUUID } from "node:crypto";
import { getAuthConfig, type AuthConfig } from "@/lib/auth/config";
import {
  attemptKeyHash,
  generateSessionToken,
  hashSessionToken,
  protectedIdentifierHash
} from "@/lib/auth/crypto";
import {
  classifyIdentifier,
  inferIdentifierTypeForAudit,
  InvalidIdentifierError
} from "@/lib/auth/identifier";
import { getDummyPasswordHash, hashPassword, validateNewPassword, verifyPassword } from "@/lib/auth/password";
import {
  canAccessUnit,
  listAvailableContexts,
  resolveInitialContext
} from "@/lib/auth/scope";
import type { AuthStore } from "@/lib/auth/store";
import type {
  AuthenticatedSession,
  AvailableContexts,
  IdentifierType,
  RequestMetadata,
  SafeSessionPayload
} from "@/lib/auth/types";

const GENERIC_LOGIN_MESSAGE =
  "Não foi possível entrar. Verifique os dados informados ou procure o administrador.";

export class PublicAuthError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "PublicAuthError";
  }
}

export interface LoginResult {
  sessionToken: string;
  payload: SafeSessionPayload;
}

function toSafePayload(session: AuthenticatedSession): SafeSessionPayload {
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      username: session.user.username,
      roleName: session.user.roleName,
      status: "ATIVO",
      organizationalScope: session.user.scope,
      mustChangePassword: session.user.mustChangePassword
    },
    binding: {
      matrixId: session.user.boundMatrixId,
      branchId: session.user.boundBranchId
    },
    activeContext: session.activeContext,
    lastPreviousAccess: session.lastPreviousAccess
  };
}

function genericLoginError(status = 401): PublicAuthError {
  return new PublicAuthError("LOGIN_RECUSADO", status, GENERIC_LOGIN_MESSAGE);
}

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly config: AuthConfig = getAuthConfig()
  ) {}

  async login(identifierInput: string, password: string, metadata: RequestMetadata): Promise<LoginResult> {
    let identifierType: IdentifierType | null = null;
    let normalizedForProtection = identifierInput.trim().slice(0, 512);

    let identifier;
    try {
      identifier = classifyIdentifier(identifierInput);
      identifierType = identifier.type;
      normalizedForProtection = identifier.normalized;
    } catch (error) {
      identifierType = inferIdentifierTypeForAudit(identifierInput);
      const protectedIdentifier = protectedIdentifierHash(
        identifierType,
        normalizedForProtection,
        this.config.auditHmacKey
      );
      const rateKeyHash = attemptKeyHash(
        protectedIdentifier,
        metadata.ipHash,
        this.config.auditHmacKey
      );
      await verifyPassword(await getDummyPasswordHash(), password);
      await this.store.recordRejectedAttempt({
        rateKeyHash,
        user: null,
        incrementUserCounter: false,
        identifierType,
        protectedIdentifier,
        internalReason:
          error instanceof InvalidIdentifierError ? error.reason : "IDENTIFICADOR_INVALIDO",
        metadata,
        maxAttempts: this.config.maxAttempts,
        blockMinutes: this.config.blockMinutes
      });
      throw genericLoginError();
    }

    const protectedIdentifier = protectedIdentifierHash(
      identifier.type,
      identifier.normalized,
      this.config.auditHmacKey
    );
    const rateKeyHash = attemptKeyHash(
      protectedIdentifier,
      metadata.ipHash,
      this.config.auditHmacKey
    );

    const throttle = await this.store.getThrottle(rateKeyHash);
    if (throttle?.blockedUntil && throttle.blockedUntil > new Date()) {
      await this.store.recordAudit({
        userId: null,
        conventionId: null,
        event: "BLOQUEIO_TEMPORARIO",
        identifierType: identifier.type,
        protectedIdentifier,
        internalReason: "LIMITE_DE_TENTATIVAS_ATIVO",
        metadata
      });
      throw genericLoginError(429);
    }

    const user = await this.store.findUserByCredential(identifier);
    const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
    const passwordMatches = password.length > 0 && (await verifyPassword(passwordHash, password));

    let failureReason: string | null = null;
    let incrementUserCounter = false;

    if (!user) {
      failureReason = "CONTA_NAO_ENCONTRADA";
    } else if (!passwordMatches) {
      failureReason = "SENHA_INCORRETA";
      incrementUserCounter = true;
    } else if (user.status !== "ATIVO") {
      failureReason = `STATUS_${user.status}`;
    } else if (user.blockedUntil && user.blockedUntil > new Date()) {
      failureReason = "BLOQUEIO_TEMPORARIO_ATIVO";
    }

    if (failureReason) {
      const rejection = await this.store.recordRejectedAttempt({
        rateKeyHash,
        user,
        incrementUserCounter,
        identifierType: identifier.type,
        protectedIdentifier,
        internalReason: failureReason,
        metadata,
        maxAttempts: this.config.maxAttempts,
        blockMinutes: this.config.blockMinutes
      });
      throw genericLoginError(rejection.blockedUntil ? 429 : 401);
    }

    if (!user) throw genericLoginError();

    let initialContext;
    try {
      initialContext = await resolveInitialContext(user, this.store);
    } catch {
      await this.store.recordRejectedAttempt({
        rateKeyHash,
        user,
        incrementUserCounter: false,
        identifierType: identifier.type,
        protectedIdentifier,
        internalReason: "VINCULO_ORGANIZACIONAL_INVALIDO",
        metadata,
        maxAttempts: this.config.maxAttempts,
        blockMinutes: this.config.blockMinutes
      });
      throw genericLoginError();
    }

    const sessionToken = generateSessionToken();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.sessionTtlHours * 60 * 60 * 1000);
    const completion = await this.store.completeLogin({
      user,
      rateKeyHash,
      sessionId,
      sessionTokenHash: hashSessionToken(sessionToken, this.config.sessionHmacKey),
      expiresAt,
      initialContext,
      identifierType: identifier.type,
      protectedIdentifier,
      metadata
    });

    return {
      sessionToken,
      payload: toSafePayload({
        sessionId,
        user,
        activeContext: initialContext,
        lastPreviousAccess: completion.lastPreviousAccess,
        expiresAt
      })
    };
  }

  async getSession(sessionToken: string): Promise<AuthenticatedSession> {
    const session = await this.store.findSession(
      hashSessionToken(sessionToken, this.config.sessionHmacKey)
    );
    if (!session) {
      throw new PublicAuthError("SESSAO_INVALIDA", 401, "Sua sessão expirou. Entre novamente.");
    }

    if (session.activeContext) {
      const decision = await canAccessUnit(
        session.user,
        session.activeContext.matrixId,
        session.activeContext.branchId,
        this.store
      );
      if (!decision.allowed || !decision.context) {
        throw new PublicAuthError("CONTEXTO_INVALIDO", 401, "Sua sessão expirou. Entre novamente.");
      }
      session.activeContext = decision.context;
    } else if (session.user.scope !== "CONVENCAO") {
      throw new PublicAuthError("CONTEXTO_AUSENTE", 401, "Sua sessão expirou. Entre novamente.");
    }

    await this.store.touchSession(session.sessionId);
    return session;
  }

  async me(sessionToken: string): Promise<SafeSessionPayload> {
    return toSafePayload(await this.getSession(sessionToken));
  }

  async availableContexts(sessionToken: string): Promise<AvailableContexts> {
    const session = await this.getSession(sessionToken);
    return listAvailableContexts(session.user, this.store);
  }

  async changeContext(
    sessionToken: string,
    matrixId: number,
    branchId: number | null,
    metadata: RequestMetadata
  ): Promise<SafeSessionPayload> {
    const session = await this.getSession(sessionToken);

    if (session.user.mustChangePassword) {
      throw new PublicAuthError(
        "TROCA_SENHA_OBRIGATORIA",
        403,
        "Troque a senha temporária antes de continuar."
      );
    }

    if (session.user.scope === "FILIAL") {
      await this.store.recordAudit({
        userId: session.user.id,
        conventionId: session.user.conventionId,
        event: "ACESSO_FORA_ESCOPO",
        internalReason: "USUARIO_FILIAL_TENTOU_TROCAR_CONTEXTO",
        metadata,
        matrixId,
        branchId
      });
      throw new PublicAuthError("ACESSO_NEGADO", 403, "Você não pode trocar esta unidade.");
    }

    const decision = await canAccessUnit(session.user, matrixId, branchId, this.store);
    if (!decision.allowed || !decision.context) {
      await this.store.recordAudit({
        userId: session.user.id,
        conventionId: session.user.conventionId,
        event: "ACESSO_FORA_ESCOPO",
        internalReason: decision.reason,
        metadata,
        matrixId,
        branchId
      });
      throw new PublicAuthError("ACESSO_NEGADO", 403, "A unidade informada não está disponível.");
    }

    await this.store.updateSessionContext(session.sessionId, decision.context);
    await this.store.recordAudit({
      userId: session.user.id,
      conventionId: session.user.conventionId,
      event: "TROCA_CONTEXTO",
      internalReason: "CONTEXTO_VALIDADO_E_ATUALIZADO",
      metadata,
      matrixId: decision.context.matrixId,
      branchId: decision.context.branchId
    });

    session.activeContext = decision.context;
    return toSafePayload(session);
  }

  async logout(sessionToken: string, metadata: RequestMetadata): Promise<void> {
    const session = await this.store.findSession(
      hashSessionToken(sessionToken, this.config.sessionHmacKey)
    );
    if (!session) return;
    await this.store.revokeSession(session.sessionId, session.user, "LOGOUT", metadata);
  }

  async changePassword(
    sessionToken: string,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata
  ): Promise<void> {
    const session = await this.getSession(sessionToken);
    const currentMatches = await verifyPassword(session.user.passwordHash, currentPassword);
    if (!currentMatches) {
      throw new PublicAuthError("SENHA_ATUAL_INVALIDA", 400, "A senha atual está incorreta.");
    }

    if (await verifyPassword(session.user.passwordHash, newPassword)) {
      throw new PublicAuthError("SENHA_REPETIDA", 400, "A nova senha deve ser diferente da atual.");
    }

    const validationErrors = validateNewPassword(newPassword);
    if (validationErrors.length) {
      throw new PublicAuthError("NOVA_SENHA_FRACA", 400, validationErrors.join(" "));
    }

    const newPasswordHash = await hashPassword(newPassword);
    await this.store.changePasswordAndRevokeSessions(session.user, newPasswordHash, metadata);
  }
}

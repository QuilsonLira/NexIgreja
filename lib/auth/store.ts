import type {
  ActiveContext,
  AuditInput,
  AuthenticatedSession,
  ClassifiedIdentifier,
  IdentifierType,
  LastAccess,
  LoginUser,
  RequestMetadata
} from "@/lib/auth/types";
import type { UnitDirectory } from "@/lib/auth/scope";

export interface ThrottleState {
  failedAttempts: number;
  blockedUntil: Date | null;
}

export interface RejectedAttemptInput {
  rateKeyHash: string;
  user: LoginUser | null;
  incrementUserCounter: boolean;
  identifierType: IdentifierType | null;
  protectedIdentifier: string;
  internalReason: string;
  metadata: RequestMetadata;
  maxAttempts: number;
  blockMinutes: number;
}

export interface RejectedAttemptResult {
  blockedUntil: Date | null;
}

export interface CompleteLoginInput {
  user: LoginUser;
  rateKeyHash: string;
  sessionId: string;
  sessionTokenHash: string;
  expiresAt: Date;
  initialContext: ActiveContext | null;
  identifierType: IdentifierType;
  protectedIdentifier: string;
  metadata: RequestMetadata;
}

export interface CompleteLoginResult {
  lastPreviousAccess: LastAccess | null;
}

export interface AuthStore extends UnitDirectory {
  findUserByCredential(identifier: ClassifiedIdentifier): Promise<LoginUser | null>;
  getThrottle(rateKeyHash: string): Promise<ThrottleState | null>;
  recordRejectedAttempt(input: RejectedAttemptInput): Promise<RejectedAttemptResult>;
  completeLogin(input: CompleteLoginInput): Promise<CompleteLoginResult>;
  findSession(sessionTokenHash: string): Promise<AuthenticatedSession | null>;
  touchSession(sessionId: string): Promise<void>;
  updateSessionContext(sessionId: string, context: ActiveContext): Promise<void>;
  revokeSession(
    sessionId: string,
    user: LoginUser,
    reason: string,
    metadata: RequestMetadata
  ): Promise<void>;
  changePasswordAndRevokeSessions(
    user: LoginUser,
    newPasswordHash: string,
    metadata: RequestMetadata
  ): Promise<void>;
  recordAudit(input: AuditInput): Promise<void>;
}

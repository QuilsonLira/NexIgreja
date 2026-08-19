import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getAuthConfig } from "@/lib/auth/config";
import { cpfLookupHash } from "@/lib/auth/crypto";
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
import { getPool, withTransaction } from "@/lib/db/mysql";

interface UserRow extends RowDataPacket {
  id: number;
  convencao_id: number;
  nome: string;
  nome_usuario: string;
  funcao: string;
  status: LoginUser["status"];
  escopo_organizacional: LoginUser["scope"];
  matriz_vinculo_id: number | null;
  filial_vinculo_id: number | null;
  senha_hash: string;
  tentativas_falhas: number;
  bloqueado_ate: Date | null;
  versao_sessao: number;
  troca_senha_obrigatoria: number | boolean;
}

interface MatrixRow extends RowDataPacket {
  id: number;
  convencao_id: number;
  nome: string;
  status: MatrixRecord["status"];
}

interface ConventionRow extends RowDataPacket {
  id: number;
  nome: string;
  status: ConventionRecord["status"];
}

interface BranchRow extends RowDataPacket {
  id: number;
  matriz_id: number;
  nome: string;
  status: BranchRecord["status"];
}

interface ThrottleRow extends RowDataPacket {
  tentativas_falhas: number;
  bloqueado_ate: Date | null;
}

interface LastAccessRow extends RowDataPacket {
  criado_em: Date;
  identificador_tipo: LastAccess["identifierType"];
  origem_resumo: string | null;
}

interface SessionRow extends UserRow {
  sessao_id: string;
  sessao_versao: number;
  matriz_ativa_id: number | null;
  filial_ativa_id: number | null;
  matriz_ativa_nome: string | null;
  filial_ativa_nome: string | null;
  ultimo_acesso_anterior_em: Date | null;
  ultimo_acesso_anterior_tipo: LastAccess["identifierType"] | null;
  ultimo_acesso_anterior_origem: string | null;
  expira_em: Date;
}

export class LoginStateChangedError extends Error {
  constructor(public readonly reason: string) {
    super("O estado da conta mudou durante a autenticacao");
    this.name = "LoginStateChangedError";
  }
}

function mapUser(row: UserRow): LoginUser {
  return {
    id: row.id,
    conventionId: row.convencao_id,
    name: row.nome,
    username: row.nome_usuario,
    roleName: row.funcao,
    status: row.status,
    scope: row.escopo_organizacional,
    boundMatrixId: row.matriz_vinculo_id,
    boundBranchId: row.filial_vinculo_id,
    passwordHash: row.senha_hash,
    failedAttempts: row.tentativas_falhas,
    blockedUntil: row.bloqueado_ate,
    sessionVersion: row.versao_sessao,
    mustChangePassword: Boolean(row.troca_senha_obrigatoria)
  };
}

function mapLastAccess(row: LastAccessRow | undefined): LastAccess | null {
  if (!row) return null;
  return {
    dateTime: row.criado_em.toISOString(),
    identifierType: row.identificador_tipo,
    originSummary: row.origem_resumo
  };
}

async function insertAudit(connection: PoolConnection, input: AuditInput): Promise<void> {
  await connection.execute(
    `INSERT INTO auditoria_autenticacao (
      usuario_id, convencao_id, evento, identificador_tipo,
      identificador_protegido, motivo_interno, ip_hash,
      ip_endereco, origem_resumo, user_agent, matriz_id, filial_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.conventionId,
      input.event,
      input.identifierType ?? null,
      input.protectedIdentifier ?? null,
      input.internalReason,
      input.metadata.ipHash,
      input.metadata.ipAddress ?? null,
      input.metadata.originSummary,
      input.metadata.userAgent,
      input.matrixId ?? null,
      input.branchId ?? null
    ]
  );
}

export class MySqlAuthStore implements AuthStore {
  async findUserByCredential(identifier: ClassifiedIdentifier): Promise<LoginUser | null> {
    const config = getAuthConfig();
    let column: "cpf_lookup_hash" | "email" | "nome_usuario";
    let value: string;

    if (identifier.type === "CPF") {
      column = "cpf_lookup_hash";
      value = cpfLookupHash(identifier.lookupValue, config.cpfLookupHmacKey);
    } else if (identifier.type === "EMAIL") {
      column = "email";
      value = identifier.lookupValue;
    } else {
      column = "nome_usuario";
      value = identifier.lookupValue;
    }

    const [rows] = await getPool().execute<UserRow[]>(
      `SELECT id, convencao_id, nome, nome_usuario, funcao, status,
        escopo_organizacional, matriz_vinculo_id, filial_vinculo_id,
        senha_hash, tentativas_falhas, bloqueado_ate, versao_sessao,
        troca_senha_obrigatoria
       FROM usuarios WHERE ${column} = ? LIMIT 1`,
      [value]
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async getThrottle(rateKeyHash: string): Promise<ThrottleState | null> {
    const [rows] = await getPool().execute<ThrottleRow[]>(
      `SELECT tentativas_falhas, bloqueado_ate
       FROM autenticacao_tentativas WHERE chave_hash = ? LIMIT 1`,
      [rateKeyHash]
    );
    if (!rows[0]) return null;
    return {
      failedAttempts: rows[0].tentativas_falhas,
      blockedUntil: rows[0].bloqueado_ate
    };
  }

  async recordRejectedAttempt(input: RejectedAttemptInput): Promise<RejectedAttemptResult> {
    return withTransaction(async (connection) => {
      const [throttleRows] = await connection.execute<ThrottleRow[]>(
        `SELECT tentativas_falhas, bloqueado_ate
         FROM autenticacao_tentativas WHERE chave_hash = ? FOR UPDATE`,
        [input.rateKeyHash]
      );
      const nextRateFailures = (throttleRows[0]?.tentativas_falhas ?? 0) + 1;
      const rateBlockedUntil =
        nextRateFailures >= input.maxAttempts
          ? new Date(Date.now() + input.blockMinutes * 60_000)
          : null;

      await connection.execute(
        `INSERT INTO autenticacao_tentativas (
          chave_hash, tentativas_falhas, bloqueado_ate, ultima_falha_em
        ) VALUES (?, ?, ?, UTC_TIMESTAMP(6))
        ON DUPLICATE KEY UPDATE
          tentativas_falhas = VALUES(tentativas_falhas),
          bloqueado_ate = VALUES(bloqueado_ate),
          ultima_falha_em = UTC_TIMESTAMP(6)`,
        [input.rateKeyHash, nextRateFailures, rateBlockedUntil]
      );

      let userBlockedUntil: Date | null = null;
      if (input.user && input.incrementUserCounter) {
        const [userRows] = await connection.execute<UserRow[]>(
          `SELECT id, convencao_id, nome, nome_usuario, funcao, status,
            escopo_organizacional, matriz_vinculo_id, filial_vinculo_id,
            senha_hash, tentativas_falhas, bloqueado_ate, versao_sessao,
            troca_senha_obrigatoria
           FROM usuarios WHERE id = ? FOR UPDATE`,
          [input.user.id]
        );
        const nextUserFailures = (userRows[0]?.tentativas_falhas ?? 0) + 1;
        userBlockedUntil =
          nextUserFailures >= input.maxAttempts
            ? new Date(Date.now() + input.blockMinutes * 60_000)
            : null;
        await connection.execute(
          `UPDATE usuarios
           SET tentativas_falhas = ?, bloqueado_ate = ?
           WHERE id = ?`,
          [nextUserFailures, userBlockedUntil, input.user.id]
        );
      }

      const blockedUntil = userBlockedUntil ?? rateBlockedUntil;
      await insertAudit(connection, {
        userId: input.user?.id ?? null,
        conventionId: input.user?.conventionId ?? null,
        event: blockedUntil ? "BLOQUEIO_TEMPORARIO" : "LOGIN_RECUSADO",
        identifierType: input.identifierType,
        protectedIdentifier: input.protectedIdentifier,
        internalReason: input.internalReason,
        metadata: input.metadata
      });

      return { blockedUntil };
    });
  }

  async completeLogin(input: CompleteLoginInput): Promise<CompleteLoginResult> {
    return withTransaction(async (connection) => {
      const [userRows] = await connection.execute<UserRow[]>(
        `SELECT id, convencao_id, nome, nome_usuario, funcao, status,
          escopo_organizacional, matriz_vinculo_id, filial_vinculo_id,
          senha_hash, tentativas_falhas, bloqueado_ate, versao_sessao,
          troca_senha_obrigatoria
         FROM usuarios WHERE id = ? FOR UPDATE`,
        [input.user.id]
      );
      const currentUser = userRows[0] ? mapUser(userRows[0]) : null;
      if (!currentUser) throw new LoginStateChangedError("USUARIO_REMOVIDO");
      if (currentUser.status !== "ATIVO") throw new LoginStateChangedError("STATUS_NAO_ATIVO");
      if (currentUser.blockedUntil && currentUser.blockedUntil > new Date()) {
        throw new LoginStateChangedError("BLOQUEIO_TEMPORARIO_ATIVO");
      }

      const [lastRows] = await connection.execute<LastAccessRow[]>(
        `SELECT criado_em, identificador_tipo, origem_resumo
         FROM auditoria_autenticacao
         WHERE usuario_id = ? AND evento = 'LOGIN_SUCESSO'
         ORDER BY criado_em DESC, id DESC LIMIT 1`,
        [currentUser.id]
      );
      const lastPreviousAccess = mapLastAccess(lastRows[0]);

      await connection.execute(
        `UPDATE usuarios
         SET tentativas_falhas = 0, bloqueado_ate = NULL,
             ultimo_login_em = UTC_TIMESTAMP(6)
         WHERE id = ?`,
        [currentUser.id]
      );
      await connection.execute("DELETE FROM autenticacao_tentativas WHERE chave_hash = ?", [
        input.rateKeyHash
      ]);

      await connection.execute(
        `INSERT INTO sessoes_usuario (
          id, usuario_id, token_hash, versao_sessao,
          matriz_ativa_id, filial_ativa_id,
          ultimo_acesso_anterior_em, ultimo_acesso_anterior_tipo,
          ultimo_acesso_anterior_origem, ip_hash, user_agent, expira_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.sessionId,
          currentUser.id,
          input.sessionTokenHash,
          currentUser.sessionVersion,
          input.initialContext?.matrixId ?? null,
          input.initialContext?.branchId ?? null,
          lastPreviousAccess ? new Date(lastPreviousAccess.dateTime) : null,
          lastPreviousAccess?.identifierType ?? null,
          lastPreviousAccess?.originSummary ?? null,
          input.metadata.ipHash,
          input.metadata.userAgent,
          input.expiresAt
        ]
      );

      await insertAudit(connection, {
        userId: currentUser.id,
        conventionId: currentUser.conventionId,
        event: "LOGIN_SUCESSO",
        identifierType: input.identifierType,
        protectedIdentifier: input.protectedIdentifier,
        internalReason: "CREDENCIAIS_VALIDAS",
        metadata: input.metadata,
        matrixId: input.initialContext?.matrixId ?? null,
        branchId: input.initialContext?.branchId ?? null
      });

      return { lastPreviousAccess };
    });
  }

  async findSession(sessionTokenHash: string): Promise<AuthenticatedSession | null> {
    const [rows] = await getPool().execute<SessionRow[]>(
      `SELECT
        s.id AS sessao_id, s.versao_sessao AS sessao_versao,
        s.matriz_ativa_id, s.filial_ativa_id,
        s.ultimo_acesso_anterior_em, s.ultimo_acesso_anterior_tipo,
        s.ultimo_acesso_anterior_origem, s.expira_em,
        ma.nome AS matriz_ativa_nome, fa.nome AS filial_ativa_nome,
        u.id, u.convencao_id, u.nome, u.nome_usuario, u.funcao, u.status,
        u.escopo_organizacional, u.matriz_vinculo_id, u.filial_vinculo_id,
        u.senha_hash, u.tentativas_falhas, u.bloqueado_ate,
        u.versao_sessao, u.troca_senha_obrigatoria
       FROM sessoes_usuario s
       INNER JOIN usuarios u ON u.id = s.usuario_id
       LEFT JOIN matrizes ma ON ma.id = s.matriz_ativa_id
       LEFT JOIN filiais fa ON fa.id = s.filial_ativa_id
       WHERE s.token_hash = ?
         AND s.revogado_em IS NULL
         AND s.expira_em > UTC_TIMESTAMP(6)
         AND u.status = 'ATIVO'
         AND s.versao_sessao = u.versao_sessao
       LIMIT 1`,
      [sessionTokenHash]
    );
    const row = rows[0];
    if (!row) return null;

    const activeContext: ActiveContext | null = row.matriz_ativa_id
      ? {
          matrixId: row.matriz_ativa_id,
          branchId: row.filial_ativa_id,
          unitName: row.filial_ativa_nome ?? row.matriz_ativa_nome ?? "Unidade",
          unitType: row.filial_ativa_id ? "FILIAL" : "MATRIZ"
        }
      : null;

    const lastPreviousAccess =
      row.ultimo_acesso_anterior_em && row.ultimo_acesso_anterior_tipo
        ? {
            dateTime: row.ultimo_acesso_anterior_em.toISOString(),
            identifierType: row.ultimo_acesso_anterior_tipo,
            originSummary: row.ultimo_acesso_anterior_origem
          }
        : null;

    return {
      sessionId: row.sessao_id,
      user: mapUser(row),
      activeContext,
      lastPreviousAccess,
      expiresAt: row.expira_em
    };
  }

  async touchSession(sessionId: string): Promise<void> {
    await getPool().execute(
      "UPDATE sessoes_usuario SET ultimo_uso_em = UTC_TIMESTAMP(6) WHERE id = ?",
      [sessionId]
    );
  }

  async updateSessionContext(sessionId: string, context: ActiveContext): Promise<void> {
    await getPool().execute(
      `UPDATE sessoes_usuario
       SET matriz_ativa_id = ?, filial_ativa_id = ?, ultimo_uso_em = UTC_TIMESTAMP(6)
       WHERE id = ? AND revogado_em IS NULL`,
      [context.matrixId, context.branchId, sessionId]
    );
  }

  async revokeSession(
    sessionId: string,
    user: LoginUser,
    reason: string,
    metadata: RequestMetadata
  ): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE sessoes_usuario
         SET revogado_em = COALESCE(revogado_em, UTC_TIMESTAMP(6)), motivo_revogacao = ?
         WHERE id = ?`,
        [reason, sessionId]
      );
      await insertAudit(connection, {
        userId: user.id,
        conventionId: user.conventionId,
        event: reason === "LOGOUT" ? "LOGOUT" : "SESSAO_REVOGADA",
        internalReason: reason,
        metadata
      });
    });
  }

  async changePasswordAndRevokeSessions(
    user: LoginUser,
    newPasswordHash: string,
    metadata: RequestMetadata
  ): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE usuarios
         SET senha_hash = ?, versao_sessao = versao_sessao + 1,
             troca_senha_obrigatoria = FALSE,
             tentativas_falhas = 0, bloqueado_ate = NULL
         WHERE id = ?`,
        [newPasswordHash, user.id]
      );
      await connection.execute(
        `UPDATE sessoes_usuario
         SET revogado_em = COALESCE(revogado_em, UTC_TIMESTAMP(6)),
             motivo_revogacao = 'TROCA_SENHA'
         WHERE usuario_id = ? AND revogado_em IS NULL`,
        [user.id]
      );
      await insertAudit(connection, {
        userId: user.id,
        conventionId: user.conventionId,
        event: "TROCA_SENHA",
        internalReason: "SENHA_ALTERADA_PELO_USUARIO",
        metadata
      });
      await insertAudit(connection, {
        userId: user.id,
        conventionId: user.conventionId,
        event: "SESSAO_REVOGADA",
        internalReason: "TODAS_AS_SESSOES_REVOGADAS_APOS_TROCA_SENHA",
        metadata
      });
    });
  }

  async recordAudit(input: AuditInput): Promise<void> {
    await withTransaction((connection) => insertAudit(connection, input));
  }

  async getConventionById(conventionId: number): Promise<ConventionRecord | null> {
    const [rows] = await getPool().execute<ConventionRow[]>(
      "SELECT id, nome, status FROM convencoes WHERE id = ? LIMIT 1",
      [conventionId]
    );
    const row = rows[0];
    return row ? { id: row.id, name: row.nome, status: row.status } : null;
  }

  async getMatrixById(matrixId: number): Promise<MatrixRecord | null> {
    const [rows] = await getPool().execute<MatrixRow[]>(
      "SELECT id, convencao_id, nome, status FROM matrizes WHERE id = ? LIMIT 1",
      [matrixId]
    );
    const row = rows[0];
    return row
      ? { id: row.id, conventionId: row.convencao_id, name: row.nome, status: row.status }
      : null;
  }

  async getBranchById(branchId: number): Promise<BranchRecord | null> {
    const [rows] = await getPool().execute<BranchRow[]>(
      "SELECT id, matriz_id, nome, status FROM filiais WHERE id = ? LIMIT 1",
      [branchId]
    );
    const row = rows[0];
    return row
      ? { id: row.id, matrixId: row.matriz_id, name: row.nome, status: row.status }
      : null;
  }

  async listActiveMatrices(conventionId: number): Promise<MatrixRecord[]> {
    const [rows] = await getPool().execute<MatrixRow[]>(
      `SELECT id, convencao_id, nome, status
       FROM matrizes WHERE convencao_id = ? AND status = 'ATIVO'
       ORDER BY nome`,
      [conventionId]
    );
    return rows.map((row) => ({
      id: row.id,
      conventionId: row.convencao_id,
      name: row.nome,
      status: row.status
    }));
  }

  async listActiveBranches(matrixIds: number[]): Promise<BranchRecord[]> {
    if (!matrixIds.length) return [];
    const placeholders = matrixIds.map(() => "?").join(", ");
    const [rows] = await getPool().execute<BranchRow[]>(
      `SELECT id, matriz_id, nome, status
       FROM filiais
       WHERE matriz_id IN (${placeholders}) AND status = 'ATIVO'
       ORDER BY nome`,
      matrixIds
    );
    return rows.map((row) => ({
      id: row.id,
      matrixId: row.matriz_id,
      name: row.nome,
      status: row.status
    }));
  }
}

export const mysqlAuthStore = new MySqlAuthStore();

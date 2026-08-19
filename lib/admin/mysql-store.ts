import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool, withTransaction } from "@/lib/db/mysql";
import { isPermissionCode, type PermissionCode } from "@/lib/admin/permissions";
import { AdminStoreConflictError, type AdminStore } from "@/lib/admin/store";
import type {
  AccessHistoryRecord,
  AccessListQuery,
  AdministrationAuditInput,
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
import type {
  IdentifierType,
  LoginUser,
  RequestMetadata
} from "@/lib/auth/types";

interface PermissionRow extends RowDataPacket {
  codigo: string;
}

interface UnitRow extends RowDataPacket {
  id: number;
  tipo: AdminUnitType;
  nome: string;
  status: AdminUnitStatus;
  convencao_id: number;
  convencao_nome: string;
  matriz_id: number | null;
  matriz_nome: string | null;
  parent_nome: string | null;
  criado_em: Date;
  atualizado_em: Date;
  total_count?: number;
}

interface OptionRow extends RowDataPacket {
  id: number;
  nome: string;
  status: AdminUnitStatus;
  matriz_id?: number;
}

interface UserAdminRow extends RowDataPacket {
  id: number;
  convencao_id: number;
  nome: string;
  nome_usuario: string;
  email: string;
  cpf_ultimos_digitos: string;
  funcao: string;
  status: UserRecord["status"];
  escopo_organizacional: UserRecord["scope"];
  matriz_vinculo_id: number | null;
  filial_vinculo_id: number | null;
  filial_matriz_id: number | null;
  matriz_nome: string | null;
  filial_nome: string | null;
  permissoes: string | null;
  sessoes_ativas: number;
  ultimo_login_em: Date | null;
  criado_em: Date;
  atualizado_em: Date;
  total_count?: number;
}

interface AccessRow extends RowDataPacket {
  id: number;
  usuario_id: number | null;
  usuario_nome: string | null;
  nome_usuario: string | null;
  evento: string;
  resultado: AccessHistoryRecord["result"];
  identificador_tipo: IdentifierType | null;
  origem_resumo: string;
  ip_endereco: string | null;
  unidade_nome: string | null;
  criado_em: Date;
  total_count?: number;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function pageResult<R extends { total_count?: number }, T>(
  rows: R[],
  page: number,
  pageSize: number,
  mapper: (row: R) => T
): PageResult<T> {
  const total = Number(rows[0]?.total_count ?? 0);
  return {
    items: rows.map(mapper),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function mapUnit(row: UnitRow): UnitRecord {
  return {
    id: row.id,
    type: row.tipo,
    name: row.nome,
    status: row.status,
    conventionId: row.convencao_id,
    conventionName: row.convencao_nome,
    matrixId: row.matriz_id,
    matrixName: row.matriz_nome,
    parentName: row.parent_nome,
    createdAt: row.criado_em.toISOString(),
    updatedAt: row.atualizado_em.toISOString()
  };
}

function parsePermissions(value: string | null): PermissionCode[] {
  if (!value) return [];
  return value.split(",").filter(isPermissionCode);
}

function mapUser(row: UserAdminRow): UserRecord {
  return {
    id: row.id,
    conventionId: row.convencao_id,
    name: row.nome,
    username: row.nome_usuario,
    email: row.email,
    cpfHint: `***.***.***-${row.cpf_ultimos_digitos}`,
    roleName: row.funcao,
    status: row.status,
    scope: row.escopo_organizacional,
    boundMatrixId: row.matriz_vinculo_id,
    boundBranchId: row.filial_vinculo_id,
    branchMatrixId: row.filial_matriz_id,
    matrixName: row.matriz_nome,
    branchName: row.filial_nome,
    permissions: parsePermissions(row.permissoes),
    activeSessions: Number(row.sessoes_ativas),
    lastLoginAt: iso(row.ultimo_login_em),
    createdAt: row.criado_em.toISOString(),
    updatedAt: row.atualizado_em.toISOString()
  };
}

function duplicateError(error: unknown): never {
  const candidate = error as { code?: string; message?: string };
  if (candidate.code === "ER_DUP_ENTRY") {
    const message = candidate.message ?? "";
    if (message.includes("uq_usuarios_nome_usuario")) throw new AdminStoreConflictError("username");
    if (message.includes("uq_usuarios_email")) throw new AdminStoreConflictError("email");
    if (message.includes("uq_usuarios_cpf_hash")) throw new AdminStoreConflictError("cpf");
    if (message.includes("uq_matrizes_convencao_nome") || message.includes("uq_filiais_matriz_nome")) {
      throw new AdminStoreConflictError("unitName");
    }
  }
  throw error;
}

function userScopeSql(actor: LoginUser, alias = "u"): { sql: string; params: number[] } {
  if (actor.scope === "CONVENCAO") {
    return { sql: `${alias}.convencao_id = ?`, params: [actor.conventionId] };
  }
  if (actor.scope === "MATRIZ") {
    return {
      sql: `(
        (${alias}.escopo_organizacional = 'MATRIZ' AND ${alias}.matriz_vinculo_id = ?)
        OR (${alias}.escopo_organizacional = 'FILIAL' AND EXISTS (
          SELECT 1 FROM filiais sf
          WHERE sf.id = ${alias}.filial_vinculo_id AND sf.matriz_id = ?
        ))
      )`,
      params: [actor.boundMatrixId ?? 0, actor.boundMatrixId ?? 0]
    };
  }
  return {
    sql: `${alias}.escopo_organizacional = 'FILIAL' AND ${alias}.filial_vinculo_id = ?`,
    params: [actor.boundBranchId ?? 0]
  };
}

async function insertAdminAudit(
  connection: PoolConnection,
  input: AdministrationAuditInput
): Promise<void> {
  await connection.execute(
    `INSERT INTO auditoria_administracao (
      ator_usuario_id, convencao_id, acao, entidade_tipo, entidade_id,
      matriz_id, filial_id, detalhes, ip_hash, ip_endereco,
      origem_resumo, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.actorUserId,
      input.conventionId,
      input.action,
      input.entityType,
      input.entityId,
      input.matrixId ?? null,
      input.branchId ?? null,
      input.details ? JSON.stringify(input.details) : null,
      input.metadata.ipHash,
      input.metadata.ipAddress ?? null,
      input.metadata.originSummary,
      input.metadata.userAgent
    ]
  );
}

async function insertAuthenticationAudit(
  connection: PoolConnection,
  target: UserRecord,
  event: "REDEFINICAO_SENHA" | "SESSAO_REVOGADA",
  reason: string,
  metadata: RequestMetadata
): Promise<void> {
  await connection.execute(
    `INSERT INTO auditoria_autenticacao (
      usuario_id, convencao_id, evento, motivo_interno, ip_hash,
      ip_endereco, origem_resumo, user_agent, matriz_id, filial_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      target.id,
      target.conventionId,
      event,
      reason,
      metadata.ipHash,
      metadata.ipAddress ?? null,
      metadata.originSummary,
      metadata.userAgent,
      target.boundMatrixId ?? target.branchMatrixId,
      target.boundBranchId
    ]
  );
}

async function replaceDirectPermissions(
  connection: PoolConnection,
  targetUserId: number,
  permissions: PermissionCode[],
  actorUserId: number
): Promise<void> {
  await connection.execute("DELETE FROM usuario_permissoes_diretas WHERE usuario_id = ?", [
    targetUserId
  ]);
  if (!permissions.length) return;
  const placeholders = permissions.map(() => "?").join(", ");
  await connection.execute(
    `INSERT INTO usuario_permissoes_diretas (
      usuario_id, permissao_id, concedida_por_usuario_id
    )
    SELECT ?, p.id, ? FROM permissoes p WHERE p.codigo IN (${placeholders})`,
    [targetUserId, actorUserId, ...permissions]
  );
}

const effectivePermissionsSql = `(
  SELECT GROUP_CONCAT(DISTINCT ep.codigo ORDER BY ep.codigo SEPARATOR ',')
  FROM permissoes ep
  WHERE ep.id IN (
    SELECT upd.permissao_id
    FROM usuario_permissoes_diretas upd
    WHERE upd.usuario_id = u.id
    UNION
    SELECT pp.permissao_id
    FROM usuario_perfis upf
    INNER JOIN perfis pf ON pf.id = upf.perfil_id AND pf.status = 'ATIVO'
    INNER JOIN perfil_permissoes pp ON pp.perfil_id = pf.id
    WHERE upf.usuario_id = u.id
  )
)`;

const baseUserSelect = `
  u.id, u.convencao_id, u.nome, u.nome_usuario, u.email,
  u.cpf_ultimos_digitos, u.funcao, u.status, u.escopo_organizacional,
  u.matriz_vinculo_id, u.filial_vinculo_id,
  fb.matriz_id AS filial_matriz_id,
  ma.nome AS matriz_nome, fb.nome AS filial_nome,
  ${effectivePermissionsSql} AS permissoes,
  (SELECT COUNT(*) FROM sessoes_usuario ss
    WHERE ss.usuario_id = u.id AND ss.revogado_em IS NULL
      AND ss.expira_em > UTC_TIMESTAMP(6)) AS sessoes_ativas,
  u.ultimo_login_em, u.criado_em, u.atualizado_em`;

export class MySqlAdminStore implements AdminStore {
  async listPermissions(userId: number): Promise<PermissionCode[]> {
    const [rows] = await getPool().execute<PermissionRow[]>(
      `SELECT DISTINCT p.codigo
       FROM permissoes p
       WHERE p.id IN (
         SELECT upd.permissao_id
         FROM usuario_permissoes_diretas upd
         WHERE upd.usuario_id = ?
         UNION
         SELECT pp.permissao_id
         FROM usuario_perfis upf
         INNER JOIN perfis pf ON pf.id = upf.perfil_id AND pf.status = 'ATIVO'
         INNER JOIN perfil_permissoes pp ON pp.perfil_id = pf.id
         WHERE upf.usuario_id = ?
       )
       ORDER BY p.codigo`,
      [userId, userId]
    );
    return rows.map((row) => row.codigo).filter(isPermissionCode);
  }

  async listUnitOptions(actor: LoginUser): Promise<AdminUnitOptions> {
    const [conventionRows] = await getPool().execute<OptionRow[]>(
      "SELECT id, nome, status FROM convencoes WHERE id = ? LIMIT 1",
      [actor.conventionId]
    );
    const convention = conventionRows[0];
    if (!convention) throw new Error("Convencao da sessao nao encontrada");

    let matrixSql = "";
    let matrixParams: number[] = [];
    let branchSql = "";
    let branchParams: number[] = [];
    if (actor.scope === "CONVENCAO") {
      matrixSql = "SELECT id, nome, status FROM matrizes WHERE convencao_id = ? AND status = 'ATIVO' ORDER BY nome";
      matrixParams = [actor.conventionId];
      branchSql = `SELECT f.id, f.nome, f.status, f.matriz_id
                   FROM filiais f INNER JOIN matrizes m ON m.id = f.matriz_id
                   WHERE m.convencao_id = ? AND m.status = 'ATIVO' AND f.status = 'ATIVO'
                   ORDER BY f.nome`;
      branchParams = [actor.conventionId];
    } else if (actor.scope === "MATRIZ") {
      matrixSql = "SELECT id, nome, status FROM matrizes WHERE id = ? AND status = 'ATIVO'";
      matrixParams = [actor.boundMatrixId ?? 0];
      branchSql = "SELECT id, nome, status, matriz_id FROM filiais WHERE matriz_id = ? AND status = 'ATIVO' ORDER BY nome";
      branchParams = [actor.boundMatrixId ?? 0];
    } else {
      matrixSql = `SELECT m.id, m.nome, m.status
                   FROM matrizes m INNER JOIN filiais f ON f.matriz_id = m.id
                   WHERE f.id = ? AND m.status = 'ATIVO'`;
      matrixParams = [actor.boundBranchId ?? 0];
      branchSql = "SELECT id, nome, status, matriz_id FROM filiais WHERE id = ? AND status = 'ATIVO'";
      branchParams = [actor.boundBranchId ?? 0];
    }

    const [[matrices], [branches]] = await Promise.all([
      getPool().execute<OptionRow[]>(matrixSql, matrixParams),
      getPool().execute<OptionRow[]>(branchSql, branchParams)
    ]);
    return {
      convention: { id: convention.id, name: convention.nome, status: convention.status },
      matrices: matrices.map((row) => ({ id: row.id, name: row.nome, status: row.status })),
      branches: branches.map((row) => ({
        id: row.id,
        name: row.nome,
        status: row.status,
        matrixId: Number(row.matriz_id)
      }))
    };
  }

  async listUnits(actor: LoginUser, query: UnitListQuery): Promise<PageResult<UnitRecord>> {
    const parts: string[] = [];
    const params: Array<string | number> = [];
    if (actor.scope === "CONVENCAO") {
      parts.push(`SELECT c.id, 'CONVENCAO' AS tipo, c.nome, c.status,
        c.id AS convencao_id, c.nome AS convencao_nome,
        NULL AS matriz_id, NULL AS matriz_nome, NULL AS parent_nome,
        c.criado_em, c.atualizado_em
        FROM convencoes c WHERE c.id = ?`);
      params.push(actor.conventionId);
      parts.push(`SELECT m.id, 'MATRIZ' AS tipo, m.nome, m.status,
        c.id AS convencao_id, c.nome AS convencao_nome,
        m.id AS matriz_id, m.nome AS matriz_nome, c.nome AS parent_nome,
        m.criado_em, m.atualizado_em
        FROM matrizes m INNER JOIN convencoes c ON c.id = m.convencao_id
        WHERE m.convencao_id = ?`);
      params.push(actor.conventionId);
      parts.push(`SELECT f.id, 'FILIAL' AS tipo, f.nome, f.status,
        c.id AS convencao_id, c.nome AS convencao_nome,
        m.id AS matriz_id, m.nome AS matriz_nome, m.nome AS parent_nome,
        f.criado_em, f.atualizado_em
        FROM filiais f INNER JOIN matrizes m ON m.id = f.matriz_id
        INNER JOIN convencoes c ON c.id = m.convencao_id
        WHERE m.convencao_id = ?`);
      params.push(actor.conventionId);
    } else if (actor.scope === "MATRIZ") {
      parts.push(`SELECT m.id, 'MATRIZ' AS tipo, m.nome, m.status,
        c.id AS convencao_id, c.nome AS convencao_nome,
        m.id AS matriz_id, m.nome AS matriz_nome, c.nome AS parent_nome,
        m.criado_em, m.atualizado_em
        FROM matrizes m INNER JOIN convencoes c ON c.id = m.convencao_id
        WHERE m.id = ?`);
      params.push(actor.boundMatrixId ?? 0);
      parts.push(`SELECT f.id, 'FILIAL' AS tipo, f.nome, f.status,
        c.id AS convencao_id, c.nome AS convencao_nome,
        m.id AS matriz_id, m.nome AS matriz_nome, m.nome AS parent_nome,
        f.criado_em, f.atualizado_em
        FROM filiais f INNER JOIN matrizes m ON m.id = f.matriz_id
        INNER JOIN convencoes c ON c.id = m.convencao_id
        WHERE f.matriz_id = ?`);
      params.push(actor.boundMatrixId ?? 0);
    } else {
      parts.push(`SELECT f.id, 'FILIAL' AS tipo, f.nome, f.status,
        c.id AS convencao_id, c.nome AS convencao_nome,
        m.id AS matriz_id, m.nome AS matriz_nome, m.nome AS parent_nome,
        f.criado_em, f.atualizado_em
        FROM filiais f INNER JOIN matrizes m ON m.id = f.matriz_id
        INNER JOIN convencoes c ON c.id = m.convencao_id
        WHERE f.id = ?`);
      params.push(actor.boundBranchId ?? 0);
    }

    const conditions: string[] = [];
    if (query.search) {
      conditions.push("(unidades.nome LIKE ? OR unidades.parent_nome LIKE ?)");
      const search = `%${query.search}%`;
      params.push(search, search);
    }
    if (query.type) {
      conditions.push("unidades.tipo = ?");
      params.push(query.type);
    }
    if (query.status) {
      conditions.push("unidades.status = ?");
      params.push(query.status);
    }
    params.push(query.pageSize, (query.page - 1) * query.pageSize);

    const [rows] = await getPool().execute<UnitRow[]>(
      `SELECT unidades.*, COUNT(*) OVER() AS total_count
       FROM (${parts.join(" UNION ALL ")}) unidades
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY CASE unidades.tipo WHEN 'CONVENCAO' THEN 1 WHEN 'MATRIZ' THEN 2 ELSE 3 END,
         unidades.nome
       LIMIT ? OFFSET ?`,
      params
    );
    return pageResult(rows, query.page, query.pageSize, mapUnit);
  }

  async getUnit(type: AdminUnitType, id: number): Promise<UnitRecord | null> {
    const sql =
      type === "CONVENCAO"
        ? `SELECT c.id, 'CONVENCAO' AS tipo, c.nome, c.status,
           c.id AS convencao_id, c.nome AS convencao_nome,
           NULL AS matriz_id, NULL AS matriz_nome, NULL AS parent_nome,
           c.criado_em, c.atualizado_em FROM convencoes c WHERE c.id = ?`
        : type === "MATRIZ"
          ? `SELECT m.id, 'MATRIZ' AS tipo, m.nome, m.status,
             c.id AS convencao_id, c.nome AS convencao_nome,
             m.id AS matriz_id, m.nome AS matriz_nome, c.nome AS parent_nome,
             m.criado_em, m.atualizado_em
             FROM matrizes m INNER JOIN convencoes c ON c.id = m.convencao_id
             WHERE m.id = ?`
          : `SELECT f.id, 'FILIAL' AS tipo, f.nome, f.status,
             c.id AS convencao_id, c.nome AS convencao_nome,
             m.id AS matriz_id, m.nome AS matriz_nome, m.nome AS parent_nome,
             f.criado_em, f.atualizado_em
             FROM filiais f INNER JOIN matrizes m ON m.id = f.matriz_id
             INNER JOIN convencoes c ON c.id = m.convencao_id
             WHERE f.id = ?`;
    const [rows] = await getPool().execute<UnitRow[]>(sql, [id]);
    return rows[0] ? mapUnit(rows[0]) : null;
  }

  async createMatrix(
    actor: LoginUser,
    conventionId: number,
    name: string,
    metadata: RequestMetadata
  ): Promise<UnitRecord> {
    let id = 0;
    try {
      await withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          "INSERT INTO matrizes (convencao_id, nome, status) VALUES (?, ?, 'ATIVO')",
          [conventionId, name]
        );
        id = result.insertId;
        await insertAdminAudit(connection, {
          actorUserId: actor.id,
          conventionId,
          action: "UNIDADE_CRIADA",
          entityType: "MATRIZ",
          entityId: id,
          matrixId: id,
          details: { name },
          metadata
        });
      });
    } catch (error) {
      duplicateError(error);
    }
    const created = await this.getUnit("MATRIZ", id);
    if (!created) throw new Error("Matriz criada nao encontrada");
    return created;
  }

  async createBranch(
    actor: LoginUser,
    matrixId: number,
    name: string,
    metadata: RequestMetadata
  ): Promise<UnitRecord> {
    let id = 0;
    try {
      await withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          "INSERT INTO filiais (matriz_id, nome, status) VALUES (?, ?, 'ATIVO')",
          [matrixId, name]
        );
        id = result.insertId;
        await insertAdminAudit(connection, {
          actorUserId: actor.id,
          conventionId: actor.conventionId,
          action: "UNIDADE_CRIADA",
          entityType: "FILIAL",
          entityId: id,
          matrixId,
          branchId: id,
          details: { name },
          metadata
        });
      });
    } catch (error) {
      duplicateError(error);
    }
    const created = await this.getUnit("FILIAL", id);
    if (!created) throw new Error("Filial criada nao encontrada");
    return created;
  }

  async updateUnit(
    actor: LoginUser,
    unit: UnitRecord,
    name: string,
    matrixId: number | null,
    metadata: RequestMetadata
  ): Promise<UnitRecord> {
    try {
      await withTransaction(async (connection) => {
        if (unit.type === "CONVENCAO") {
          await connection.execute("UPDATE convencoes SET nome = ? WHERE id = ?", [name, unit.id]);
        } else if (unit.type === "MATRIZ") {
          await connection.execute("UPDATE matrizes SET nome = ? WHERE id = ?", [name, unit.id]);
        } else {
          await connection.execute("UPDATE filiais SET nome = ?, matriz_id = ? WHERE id = ?", [
            name,
            matrixId,
            unit.id
          ]);
        }
        await insertAdminAudit(connection, {
          actorUserId: actor.id,
          conventionId: unit.conventionId,
          action: "UNIDADE_EDITADA",
          entityType: unit.type,
          entityId: unit.id,
          matrixId: unit.type === "MATRIZ" ? unit.id : matrixId,
          branchId: unit.type === "FILIAL" ? unit.id : null,
          details: { previousName: unit.name, name, previousMatrixId: unit.matrixId, matrixId },
          metadata
        });
      });
    } catch (error) {
      duplicateError(error);
    }
    const updated = await this.getUnit(unit.type, unit.id);
    if (!updated) throw new Error("Unidade atualizada nao encontrada");
    return updated;
  }

  async setUnitStatus(
    actor: LoginUser,
    unit: UnitRecord,
    status: AdminUnitStatus,
    metadata: RequestMetadata
  ): Promise<UnitRecord> {
    await withTransaction(async (connection) => {
      const table = unit.type === "CONVENCAO" ? "convencoes" : unit.type === "MATRIZ" ? "matrizes" : "filiais";
      await connection.execute(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, unit.id]);
      await insertAdminAudit(connection, {
        actorUserId: actor.id,
        conventionId: unit.conventionId,
        action: status === "ATIVO" ? "UNIDADE_ATIVADA" : "UNIDADE_DESATIVADA",
        entityType: unit.type,
        entityId: unit.id,
        matrixId: unit.type === "MATRIZ" ? unit.id : unit.matrixId,
        branchId: unit.type === "FILIAL" ? unit.id : null,
        details: { previousStatus: unit.status, status },
        metadata
      });
    });
    const updated = await this.getUnit(unit.type, unit.id);
    if (!updated) throw new Error("Unidade atualizada nao encontrada");
    return updated;
  }

  async listUsers(actor: LoginUser, query: UserListQuery): Promise<PageResult<UserRecord>> {
    const scope = userScopeSql(actor);
    const conditions = [scope.sql];
    const params: Array<string | number> = [...scope.params];
    if (query.search) {
      conditions.push("(u.nome LIKE ? OR u.nome_usuario LIKE ? OR u.email LIKE ? OR u.funcao LIKE ?)");
      const search = `%${query.search}%`;
      params.push(search, search, search, search);
    }
    if (query.scope) {
      conditions.push("u.escopo_organizacional = ?");
      params.push(query.scope);
    }
    if (query.status) {
      conditions.push("u.status = ?");
      params.push(query.status);
    }
    params.push(query.pageSize, (query.page - 1) * query.pageSize);

    const [rows] = await getPool().execute<UserAdminRow[]>(
      `SELECT ${baseUserSelect}, COUNT(*) OVER() AS total_count
       FROM usuarios u
       LEFT JOIN matrizes ma ON ma.id = u.matriz_vinculo_id
       LEFT JOIN filiais fb ON fb.id = u.filial_vinculo_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY u.nome
       LIMIT ? OFFSET ?`,
      params
    );
    return pageResult(rows, query.page, query.pageSize, mapUser);
  }

  async getUser(id: number): Promise<UserRecord | null> {
    const [rows] = await getPool().execute<UserAdminRow[]>(
      `SELECT ${baseUserSelect}
       FROM usuarios u
       LEFT JOIN matrizes ma ON ma.id = u.matriz_vinculo_id
       LEFT JOIN filiais fb ON fb.id = u.filial_vinculo_id
       WHERE u.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async createUser(
    actor: LoginUser,
    input: Required<Pick<PersistedUserInput, "cpfLookupHash" | "cpfLastDigits" | "passwordHash">> & PersistedUserInput,
    metadata: RequestMetadata
  ): Promise<UserRecord> {
    let id = 0;
    try {
      await withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO usuarios (
            convencao_id, nome, nome_usuario, email, cpf_lookup_hash,
            cpf_ultimos_digitos, senha_hash, funcao, status,
            escopo_organizacional, matriz_vinculo_id, filial_vinculo_id,
            troca_senha_obrigatoria
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?, ?, ?, TRUE)`,
          [
            input.conventionId,
            input.name,
            input.username,
            input.email,
            input.cpfLookupHash,
            input.cpfLastDigits,
            input.passwordHash,
            input.roleName,
            input.scope,
            input.matrixId,
            input.branchId
          ]
        );
        id = result.insertId;
        await replaceDirectPermissions(connection, id, input.permissions, actor.id);
        await insertAdminAudit(connection, {
          actorUserId: actor.id,
          conventionId: input.conventionId,
          action: "USUARIO_CRIADO",
          entityType: "USUARIO",
          entityId: id,
          matrixId: input.matrixId,
          branchId: input.branchId,
          details: { scope: input.scope, permissions: input.permissions },
          metadata
        });
      });
    } catch (error) {
      duplicateError(error);
    }
    const created = await this.getUser(id);
    if (!created) throw new Error("Usuario criado nao encontrado");
    return created;
  }

  async updateUser(
    actor: LoginUser,
    target: UserRecord,
    input: PersistedUserInput,
    metadata: RequestMetadata
  ): Promise<UserRecord> {
    const securityChanged =
      target.scope !== input.scope ||
      target.boundMatrixId !== input.matrixId ||
      target.boundBranchId !== input.branchId ||
      [...target.permissions].sort().join(",") !== [...input.permissions].sort().join(",");
    try {
      await withTransaction(async (connection) => {
        const sets = [
          "nome = ?",
          "nome_usuario = ?",
          "email = ?",
          "funcao = ?",
          "escopo_organizacional = ?",
          "matriz_vinculo_id = ?",
          "filial_vinculo_id = ?"
        ];
        const values: Array<string | number | null> = [
          input.name,
          input.username,
          input.email,
          input.roleName,
          input.scope,
          input.matrixId,
          input.branchId
        ];
        if (input.cpfLookupHash && input.cpfLastDigits) {
          sets.push("cpf_lookup_hash = ?", "cpf_ultimos_digitos = ?");
          values.push(input.cpfLookupHash, input.cpfLastDigits);
        }
        if (securityChanged) sets.push("versao_sessao = versao_sessao + 1");
        values.push(target.id);
        await connection.execute(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = ?`, values);
        await replaceDirectPermissions(connection, target.id, input.permissions, actor.id);
        if (securityChanged) {
          await connection.execute(
            `UPDATE sessoes_usuario
             SET revogado_em = COALESCE(revogado_em, UTC_TIMESTAMP(6)),
                 motivo_revogacao = 'CADASTRO_OU_PERMISSOES_ALTERADOS'
             WHERE usuario_id = ? AND revogado_em IS NULL`,
            [target.id]
          );
        }
        await insertAdminAudit(connection, {
          actorUserId: actor.id,
          conventionId: target.conventionId,
          action: "USUARIO_EDITADO",
          entityType: "USUARIO",
          entityId: target.id,
          matrixId: input.matrixId,
          branchId: input.branchId,
          details: {
            previousScope: target.scope,
            scope: input.scope,
            permissions: input.permissions,
            sessionsRevoked: securityChanged
          },
          metadata
        });
      });
    } catch (error) {
      duplicateError(error);
    }
    const updated = await this.getUser(target.id);
    if (!updated) throw new Error("Usuario atualizado nao encontrado");
    return updated;
  }

  async setUserStatus(
    actor: LoginUser,
    target: UserRecord,
    status: "ATIVO" | "INATIVO",
    metadata: RequestMetadata
  ): Promise<UserRecord> {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE usuarios
         SET status = ?, versao_sessao = versao_sessao + 1,
             tentativas_falhas = 0, bloqueado_ate = NULL
         WHERE id = ?`,
        [status, target.id]
      );
      if (status === "INATIVO") {
        await connection.execute(
          `UPDATE sessoes_usuario
           SET revogado_em = COALESCE(revogado_em, UTC_TIMESTAMP(6)),
               motivo_revogacao = 'USUARIO_DESATIVADO'
           WHERE usuario_id = ? AND revogado_em IS NULL`,
          [target.id]
        );
      }
      await insertAdminAudit(connection, {
        actorUserId: actor.id,
        conventionId: target.conventionId,
        action: status === "ATIVO" ? "USUARIO_ATIVADO" : "USUARIO_DESATIVADO",
        entityType: "USUARIO",
        entityId: target.id,
        matrixId: target.boundMatrixId ?? target.branchMatrixId,
        branchId: target.boundBranchId,
        details: { previousStatus: target.status, status },
        metadata
      });
    });
    const updated = await this.getUser(target.id);
    if (!updated) throw new Error("Usuario atualizado nao encontrado");
    return updated;
  }

  async resetUserPassword(
    actor: LoginUser,
    target: UserRecord,
    passwordHash: string,
    metadata: RequestMetadata
  ): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE usuarios
         SET senha_hash = ?, troca_senha_obrigatoria = TRUE,
             versao_sessao = versao_sessao + 1,
             tentativas_falhas = 0, bloqueado_ate = NULL
         WHERE id = ?`,
        [passwordHash, target.id]
      );
      await connection.execute(
        `UPDATE sessoes_usuario
         SET revogado_em = COALESCE(revogado_em, UTC_TIMESTAMP(6)),
             motivo_revogacao = 'REDEFINICAO_SENHA_ADMINISTRATIVA'
         WHERE usuario_id = ? AND revogado_em IS NULL`,
        [target.id]
      );
      await insertAuthenticationAudit(
        connection,
        target,
        "REDEFINICAO_SENHA",
        `REDEFINIDA_PELO_USUARIO_${actor.id}`,
        metadata
      );
      await insertAuthenticationAudit(
        connection,
        target,
        "SESSAO_REVOGADA",
        "TODAS_AS_SESSOES_REVOGADAS_APOS_REDEFINICAO",
        metadata
      );
      await insertAdminAudit(connection, {
        actorUserId: actor.id,
        conventionId: target.conventionId,
        action: "SENHA_REDEFINIDA",
        entityType: "USUARIO",
        entityId: target.id,
        matrixId: target.boundMatrixId ?? target.branchMatrixId,
        branchId: target.boundBranchId,
        details: { sessionsRevoked: true, mustChangePassword: true },
        metadata
      });
    });
  }

  async revokeUserSessions(
    actor: LoginUser,
    target: UserRecord,
    metadata: RequestMetadata
  ): Promise<number> {
    return withTransaction(async (connection) => {
      await connection.execute("SELECT id FROM usuarios WHERE id = ? FOR UPDATE", [target.id]);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE sessoes_usuario
         SET revogado_em = UTC_TIMESTAMP(6), motivo_revogacao = 'ENCERRADA_PELO_ADMINISTRADOR'
         WHERE usuario_id = ? AND revogado_em IS NULL AND expira_em > UTC_TIMESTAMP(6)`,
        [target.id]
      );
      await insertAuthenticationAudit(
        connection,
        target,
        "SESSAO_REVOGADA",
        `ENCERRADA_PELO_USUARIO_${actor.id}`,
        metadata
      );
      await insertAdminAudit(connection, {
        actorUserId: actor.id,
        conventionId: target.conventionId,
        action: "SESSOES_ENCERRADAS",
        entityType: "USUARIO",
        entityId: target.id,
        matrixId: target.boundMatrixId ?? target.branchMatrixId,
        branchId: target.boundBranchId,
        details: { revokedSessions: result.affectedRows },
        metadata
      });
      return result.affectedRows;
    });
  }

  async listAccessHistory(
    actor: LoginUser,
    query: AccessListQuery
  ): Promise<PageResult<AccessHistoryRecord>> {
    const scope = userScopeSql(actor);
    const conditions =
      actor.scope === "CONVENCAO" ? ["a.convencao_id = ?"] : [`u.id IS NOT NULL AND ${scope.sql}`];
    const params: Array<string | number> =
      actor.scope === "CONVENCAO" ? [actor.conventionId] : [...scope.params];

    if (query.search) {
      conditions.push("(u.nome LIKE ? OR u.nome_usuario LIKE ? OR a.origem_resumo LIKE ? OR a.ip_endereco LIKE ?)");
      const search = `%${query.search}%`;
      params.push(search, search, search, search);
    }
    if (query.result === "SUCESSO") conditions.push("a.evento = 'LOGIN_SUCESSO'");
    if (query.result === "FALHA") {
      conditions.push("a.evento IN ('LOGIN_RECUSADO', 'BLOQUEIO_TEMPORARIO', 'ACESSO_FORA_ESCOPO')");
    }
    if (query.result === "SEGURANCA") {
      conditions.push("a.evento NOT IN ('LOGIN_SUCESSO', 'LOGIN_RECUSADO', 'BLOQUEIO_TEMPORARIO', 'ACESSO_FORA_ESCOPO')");
    }
    if (query.identifierType) {
      conditions.push("a.identificador_tipo = ?");
      params.push(query.identifierType);
    }
    if (query.dateFrom) {
      conditions.push("a.criado_em >= ?");
      params.push(`${query.dateFrom} 00:00:00`);
    }
    if (query.dateTo) {
      conditions.push("a.criado_em < DATE_ADD(?, INTERVAL 1 DAY)");
      params.push(`${query.dateTo} 00:00:00`);
    }
    params.push(query.pageSize, (query.page - 1) * query.pageSize);

    const [rows] = await getPool().execute<AccessRow[]>(
      `SELECT a.id, a.usuario_id, u.nome AS usuario_nome, u.nome_usuario,
        a.evento,
        CASE
          WHEN a.evento = 'LOGIN_SUCESSO' THEN 'SUCESSO'
          WHEN a.evento IN ('LOGIN_RECUSADO', 'BLOQUEIO_TEMPORARIO', 'ACESSO_FORA_ESCOPO') THEN 'FALHA'
          ELSE 'SEGURANCA'
        END AS resultado,
        a.identificador_tipo, a.origem_resumo, a.ip_endereco,
        COALESCE(f.nome, m.nome) AS unidade_nome,
        a.criado_em, COUNT(*) OVER() AS total_count
       FROM auditoria_autenticacao a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN matrizes m ON m.id = a.matriz_id
       LEFT JOIN filiais f ON f.id = a.filial_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.criado_em DESC, a.id DESC
       LIMIT ? OFFSET ?`,
      params
    );

    return pageResult(rows, query.page, query.pageSize, (row): AccessHistoryRecord => ({
      id: row.id,
      userId: row.usuario_id,
      userName: row.usuario_nome ?? "Identificador não reconhecido",
      username: row.nome_usuario,
      event: row.evento,
      result: row.resultado,
      identifierType: row.identificador_tipo,
      originSummary: row.origem_resumo,
      ipAddress: row.ip_endereco,
      unitName: row.unidade_nome,
      occurredAt: row.criado_em.toISOString()
    }));
  }
}

export const mysqlAdminStore = new MySqlAdminStore();

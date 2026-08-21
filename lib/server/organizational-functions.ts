import type { OrganizationalFunctionRecord } from "@/lib/admin/types";
import { cleanFunctionName, FUNCTION_DESCRIPTION_MAX_LENGTH, normalizedFunctionName } from "@/lib/functions/policy";
import { ApiError, database } from "@/lib/server/auth";
import { generatedId, requirePermission, writeAudit } from "@/lib/server/admin";

type FunctionRow = { id: number; tenant_id: number; name: string; description: string | null; status: "ATIVO" | "INATIVO"; membership_count: number; created_at: string; updated_at: string };
const FUNCTION_SELECT = `SELECT fn.id, fn.tenant_id, fn.name, fn.description, fn.status, fn.created_at, fn.updated_at, COUNT(membership.id) AS membership_count FROM organizational_functions fn LEFT JOIN tenant_memberships membership ON membership.function_id = fn.id AND membership.tenant_id = fn.tenant_id`;

function mapFunction(row: FunctionRow): OrganizationalFunctionRecord {
  return { id: row.id, tenantId: row.tenant_id, name: row.name, description: row.description, status: row.status, membershipCount: Number(row.membership_count), createdAt: row.created_at, updatedAt: row.updated_at };
}

function normalizedInput(input: { name?: unknown; description?: unknown }) {
  const name = cleanFunctionName(input.name);
  if (!name) throw new ApiError(400, "DADOS_INVALIDOS", "O nome da função deve ter entre 2 e 100 caracteres.");
  if (input.description !== null && input.description !== undefined && typeof input.description !== "string") throw new ApiError(400, "DADOS_INVALIDOS", "Revise a descrição da função.");
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > FUNCTION_DESCRIPTION_MAX_LENGTH) throw new ApiError(400, "DADOS_INVALIDOS", `A descrição deve ter no máximo ${FUNCTION_DESCRIPTION_MAX_LENGTH} caracteres.`);
  return { name, normalizedName: normalizedFunctionName(name), description: description || null };
}

async function functionById(id: number, tenantId: number): Promise<FunctionRow | null> {
  return database().prepare(`${FUNCTION_SELECT} WHERE fn.id = ? AND fn.tenant_id = ? GROUP BY fn.id LIMIT 1`).bind(id, tenantId).first<FunctionRow>();
}

async function assertUniqueFunction(tenantId: number, normalizedName: string, excludedId?: number) {
  const duplicate = await database().prepare("SELECT id FROM organizational_functions WHERE tenant_id = ? AND normalized_name = ? AND (? IS NULL OR id <> ?) LIMIT 1").bind(tenantId, normalizedName, excludedId ?? null, excludedId ?? null).first<{ id: number }>();
  if (duplicate) throw new ApiError(409, "FUNCAO_DUPLICADA", "Já existe uma função com este nome nesta organização.");
}

export async function listOrganizationalFunctions(request: Request): Promise<OrganizationalFunctionRecord[]> {
  const { session } = await requirePermission(request, "FUNCOES_VISUALIZAR");
  const rows = await database().prepare(`${FUNCTION_SELECT} WHERE fn.tenant_id = ? GROUP BY fn.id ORDER BY fn.name COLLATE NOCASE`).bind(session.user.tenantId).all<FunctionRow>();
  return rows.results.map(mapFunction);
}

export async function createOrganizationalFunction(request: Request, input: { name?: unknown; description?: unknown }): Promise<OrganizationalFunctionRecord> {
  const { session, metadata } = await requirePermission(request, "FUNCOES_CRIAR");
  const values = normalizedInput(input);
  await assertUniqueFunction(session.user.tenantId, values.normalizedName);
  const id = generatedId();
  const timestamp = new Date().toISOString();
  await database().prepare("INSERT INTO organizational_functions (id, tenant_id, name, normalized_name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ATIVO', ?, ?)").bind(id, session.user.tenantId, values.name, values.normalizedName, values.description, timestamp, timestamp).run();
  await writeAudit(session, metadata, "FUNCAO_CRIADA", "FUNCAO", id, session.user.conventionId, { name: values.name });
  return mapFunction((await functionById(id, session.user.tenantId))!);
}

export async function updateOrganizationalFunction(request: Request, id: number, input: { name?: unknown; description?: unknown }): Promise<OrganizationalFunctionRecord> {
  const { session, metadata } = await requirePermission(request, "FUNCOES_EDITAR");
  const current = await functionById(id, session.user.tenantId);
  if (!current) throw new ApiError(404, "FUNCAO_NAO_ENCONTRADA", "Função não encontrada.");
  const values = normalizedInput(input);
  await assertUniqueFunction(session.user.tenantId, values.normalizedName, id);
  const timestamp = new Date().toISOString();
  await database().batch([
    database().prepare("UPDATE organizational_functions SET name = ?, normalized_name = ?, description = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").bind(values.name, values.normalizedName, values.description, timestamp, id, session.user.tenantId),
    database().prepare("UPDATE tenant_memberships SET role_name = ?, updated_at = ? WHERE function_id = ? AND tenant_id = ?").bind(values.name, timestamp, id, session.user.tenantId),
  ]);
  await writeAudit(session, metadata, "FUNCAO_EDITADA", "FUNCAO", id, session.user.conventionId, { previousName: current.name, name: values.name });
  return mapFunction((await functionById(id, session.user.tenantId))!);
}

export async function setOrganizationalFunctionStatus(request: Request, id: number, status: "ATIVO" | "INATIVO"): Promise<OrganizationalFunctionRecord> {
  const { session, metadata } = await requirePermission(request, "FUNCOES_DESATIVAR");
  if (status !== "ATIVO" && status !== "INATIVO") throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
  const current = await functionById(id, session.user.tenantId);
  if (!current) throw new ApiError(404, "FUNCAO_NAO_ENCONTRADA", "Função não encontrada.");
  await database().prepare("UPDATE organizational_functions SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").bind(status, new Date().toISOString(), id, session.user.tenantId).run();
  await writeAudit(session, metadata, status === "ATIVO" ? "FUNCAO_ATIVADA" : "FUNCAO_DESATIVADA", "FUNCAO", id, session.user.conventionId, { membershipsPreserved: current.membership_count });
  return mapFunction((await functionById(id, session.user.tenantId))!);
}

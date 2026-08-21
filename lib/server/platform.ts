import type { PlatformOwnerSession, RequestMetadata } from "@/lib/types";
import type { AdminUnitStatus, AdminUnitType, DeletionAssessment, DeletionDependency, PageResult, TenantRecord, UnitRecord, UnitWriteInput, UserRecord } from "@/lib/admin/types";
import { archivedUnitState, canArchiveEntity, canDeleteOwnAccount, permanentDeletionPhrase, platformOwnerStatus, restoredUnitStatus, userPermanentDeletionPhrase, hasBlockingDependencies } from "@/lib/platform/policy";
import { ApiError, assertTrustedOrigin, database, platformOwnerSession, requestMetadata, verifyUserPassword } from "@/lib/server/auth";
import { allUnits, assertUniqueCnpj, assertUniqueUnit, generatedId, normalizeUnitInput, unitById, unitByAnyId } from "@/lib/server/admin";
import { normalizeTenantSlug } from "@/lib/tenant/policy";
import { addDays, todayInBrazil } from "@/lib/billing/policy";

type PlatformContext = { session: PlatformOwnerSession; metadata: RequestMetadata };

function nowIso(): string {
  return new Date().toISOString();
}

function platformCode(name: string, id: number): string {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 80);
  return `CONVENCAO-${slug}-${String(id).slice(-6)}`;
}

function secureSevenDigitCode(): string {
  const range = 9_000_000;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  let value: number;
  do value = crypto.getRandomValues(new Uint32Array(1))[0]; while (value >= limit);
  return String(1_000_000 + (value % range));
}

async function uniqueInstitutionCode(): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const code = secureSevenDigitCode();
    const exists = await database().prepare("SELECT 1 FROM tenants WHERE access_code = ? LIMIT 1").bind(code).first();
    if (!exists) return code;
  }
  throw new ApiError(503, "CODIGO_INDISPONIVEL", "Não foi possível gerar o código da instituição. Tente novamente.");
}

function page<T>(items: T[], pageInput: unknown, pageSizeInput: unknown): PageResult<T> {
  const parsedSize = Number(pageSizeInput);
  const pageSize = Number.isInteger(parsedSize) && parsedSize > 0 ? Math.min(parsedSize, 50) : 10;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const parsedPage = Number(pageInput);
  const current = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageNumber = Math.min(current, totalPages);
  return { items: items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), page: pageNumber, pageSize, total, totalPages };
}

function dependencySummary(entityLabel: string, name: string, dependencies: readonly DeletionDependency[]): string {
  if (!dependencies.length) return `${entityLabel} ${name} pode ser excluído definitivamente.`;
  const detail = dependencies.map((item) => `${item.count} ${item.label}`).join(", ");
  return `Não é possível excluir ${entityLabel.toLowerCase()} ${name}. Existem ${detail} vinculados. O registro deve permanecer arquivado.`;
}

async function count(sql: string, ...bindings: unknown[]): Promise<number> {
  const row = await database().prepare(sql).bind(...bindings).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

function compactDependencies(items: DeletionDependency[]): DeletionDependency[] {
  return items.filter((item) => item.count > 0);
}

export async function requirePlatformOwner(request: Request, mutation = false): Promise<PlatformContext> {
  if (mutation) assertTrustedOrigin(request);
  const session = await platformOwnerSession(request);
  if (session.user.mustChangePassword) {
    throw new ApiError(403, "TROCA_SENHA_OBRIGATORIA", "Troque a senha temporária antes de acessar a administração da plataforma.");
  }
  if (platformOwnerStatus(session.user.isPlatformOwner) !== 200) {
    throw new ApiError(403, "PERMISSAO_PLATFORM_OWNER_NECESSARIA", "Esta operação é exclusiva do proprietário do NexIgreja.");
  }
  return { session, metadata: requestMetadata(request) };
}

async function writePlatformAudit(
  context: PlatformContext,
  action: string,
  unit: Pick<UnitRecord, "id" | "tenantId" | "type" | "conventionId">,
  details: Record<string, unknown> = {},
): Promise<void> {
  await database().prepare(
    "INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, convention_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, ?, 'UNIDADE', ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    context.session.user.id,
    unit.tenantId,
    action,
    unit.id,
    unit.conventionId,
    unit.id,
    context.metadata.ipAddress,
    context.metadata.userAgent,
    context.metadata.deviceSummary,
    JSON.stringify(details),
    nowIso(),
  ).run();
}

function tenantName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 150) {
    throw new ApiError(400, "DADOS_INVALIDOS", "O nome do cliente deve ter entre 2 e 150 caracteres.");
  }
  return name;
}

async function tenantRecord(id: number): Promise<TenantRecord | null> {
  return database().prepare(`SELECT tenant.id, tenant.name, tenant.slug, tenant.access_code AS accessCode, tenant.status,
    (SELECT COUNT(*) FROM organizational_units unit WHERE unit.tenant_id = tenant.id AND unit.type = 'CONVENCAO' AND unit.archived_at IS NULL) AS conventionCount,
    (SELECT COUNT(*) FROM tenant_memberships membership WHERE membership.tenant_id = tenant.id AND membership.archived_at IS NULL) AS userCount,
    tenant.created_at AS createdAt, tenant.updated_at AS updatedAt
    FROM tenants tenant WHERE tenant.id = ? LIMIT 1`).bind(id).first<TenantRecord>();
}

async function writeTenantAudit(context: PlatformContext, action: string, tenant: TenantRecord, details: Record<string, unknown> = {}): Promise<void> {
  await database().prepare("INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, ?, 'TENANT', ?, ?, ?, ?, ?, ?)")
    .bind(context.session.user.id, tenant.id, action, tenant.id, context.metadata.ipAddress, context.metadata.userAgent, context.metadata.deviceSummary, JSON.stringify({ name: tenant.name, ...details }), nowIso()).run();
}

export async function listPlatformTenants(
  request: Request,
  query: { search?: unknown; status?: unknown; page?: unknown; pageSize?: unknown },
): Promise<PageResult<TenantRecord>> {
  await requirePlatformOwner(request);
  const rows = await database().prepare(`SELECT tenant.id, tenant.name, tenant.slug, tenant.access_code AS accessCode, tenant.status,
    (SELECT COUNT(*) FROM organizational_units unit WHERE unit.tenant_id = tenant.id AND unit.type = 'CONVENCAO' AND unit.archived_at IS NULL) AS conventionCount,
    (SELECT COUNT(*) FROM tenant_memberships membership WHERE membership.tenant_id = tenant.id AND membership.archived_at IS NULL) AS userCount,
    tenant.created_at AS createdAt, tenant.updated_at AS updatedAt FROM tenants tenant ORDER BY tenant.name`).all<TenantRecord>();
  const search = typeof query.search === "string" ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120) : "";
  const status = ["ATIVO", "SUSPENSO", "CANCELADO"].includes(String(query.status)) ? String(query.status) : null;
  const filtered = rows.results.filter((tenant) => (!status || tenant.status === status)
    && (!search || `${tenant.name} ${tenant.slug} ${tenant.accessCode}`.toLocaleLowerCase("pt-BR").includes(search)));
  return page(filtered, query.page, query.pageSize);
}

export async function createPlatformTenant(request: Request, input: { name?: unknown; slug?: unknown }): Promise<TenantRecord> {
  const context = await requirePlatformOwner(request, true);
  const name = tenantName(input.name);
  const slug = normalizeTenantSlug(typeof input.slug === "string" && input.slug.trim() ? input.slug : name);
  if (slug.length < 2) throw new ApiError(400, "SLUG_INVALIDO", "Informe um identificador válido para o cliente.");
  const duplicate = await database().prepare("SELECT id FROM tenants WHERE slug = ? LIMIT 1").bind(slug).first<{ id: number }>();
  if (duplicate) throw new ApiError(409, "TENANT_DUPLICADO", "Já existe um cliente com este identificador.");
  const id = generatedId();
  const accessCode = await uniqueInstitutionCode();
  const timestamp = nowIso();
  const today=todayInBrazil(); const subscriptionId=generatedId();
  await database().batch([
    database().prepare("INSERT INTO tenants (id, name, slug, access_code, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'ATIVO', ?, ?)").bind(id, name, slug, accessCode, timestamp, timestamp),
    database().prepare("INSERT INTO commercial_profiles (tenant_id,person_type,legal_name,customer_since,created_at,updated_at) VALUES (?,'PESSOA_JURIDICA',?,?,?,?)").bind(id,name,today,timestamp,timestamp),
    database().prepare("INSERT INTO tenant_subscriptions (id,tenant_id,plan_id,contracted_price_cents,billing_period,status,start_date,grace_days,trial_start_date,trial_end_date,auto_renew,notes,created_at,updated_at) VALUES (?,?,NULL,0,'MENSAL','TESTE',?,5,?,?,1,'Teste inicial criado automaticamente.',?,?)").bind(subscriptionId,id,today,today,addDays(today,14),timestamp,timestamp),
  ]);
  const tenant = (await tenantRecord(id))!;
  await writeTenantAudit(context, "TENANT_CRIADO", tenant);
  return tenant;
}

export async function regenerateInstitutionCode(request: Request, id: number, confirmed: boolean): Promise<TenantRecord> {
  const context = await requirePlatformOwner(request, true);
  if (!confirmed) throw new ApiError(400, "CONFIRMACAO_NECESSARIA", "Confirme a geração de um novo código.");
  const tenant = await tenantRecord(id);
  if (!tenant) throw new ApiError(404, "TENANT_NAO_ENCONTRADO", "Cliente não encontrado.");
  const accessCode = await uniqueInstitutionCode();
  await database().batch([
    database().prepare("UPDATE tenants SET access_code = ?, updated_at = ? WHERE id = ?").bind(accessCode, nowIso(), id),
    database().prepare("DELETE FROM tenant_access_contexts WHERE tenant_id = ?").bind(id),
  ]);
  const updated = (await tenantRecord(id))!;
  await writeTenantAudit(context, "PLATFORM_TENANT_ACCESS_CODE_REGENERATED", updated, { previousCodeFingerprint: tenant.accessCode.slice(-2) });
  return updated;
}

export async function enterTenantAdministration(request: Request, id: number): Promise<void> {
  const context = await requirePlatformOwner(request, true);
  const tenant = await tenantRecord(id);
  if (!tenant || tenant.status !== "ATIVO") throw new ApiError(404, "TENANT_NAO_ENCONTRADO", "Cliente ativo não encontrado.");
  const convention = await database().prepare("SELECT id FROM organizational_units WHERE tenant_id = ? AND type = 'CONVENCAO' AND status = 'ATIVO' AND archived_at IS NULL ORDER BY id LIMIT 1").bind(id).first<{ id: number }>();
  if (!convention) throw new ApiError(409, "CONVENCAO_INDISPONIVEL", "Este cliente não possui uma Convenção ativa para administrar.");
  await database().prepare("UPDATE auth_sessions SET tenant_id = ?, membership_id = NULL, selected_unit_id = ?, platform_context_active = 1, last_seen_at = ? WHERE id = ? AND user_id = ?")
    .bind(id, convention.id, nowIso(), context.session.sessionId, context.session.user.id).run();
  await writeTenantAudit(context, "PLATFORM_TENANT_CONTEXT_ENTER", tenant, { conventionId: convention.id });
}

export async function leaveTenantAdministration(request: Request): Promise<void> {
  const context = await requirePlatformOwner(request, true);
  const current = await database().prepare("SELECT tenant_id FROM auth_sessions WHERE id = ? AND user_id = ? LIMIT 1")
    .bind(context.session.sessionId, context.session.user.id).first<{ tenant_id: number | null }>();
  const tenant = current?.tenant_id ? await tenantRecord(current.tenant_id) : null;
  await database().prepare("UPDATE auth_sessions SET tenant_id = NULL, membership_id = NULL, selected_unit_id = NULL, platform_context_active = 0, last_seen_at = ? WHERE id = ? AND user_id = ?").bind(nowIso(), context.session.sessionId, context.session.user.id).run();
  if (tenant) await writeTenantAudit(context, "PLATFORM_TENANT_CONTEXT_EXIT", tenant);
}

export async function updatePlatformTenant(request: Request, id: number, input: { name?: unknown; slug?: unknown }): Promise<TenantRecord> {
  const context = await requirePlatformOwner(request, true);
  const current = await tenantRecord(id);
  if (!current) throw new ApiError(404, "TENANT_NAO_ENCONTRADO", "Cliente não encontrado.");
  const name = tenantName(input.name);
  const slug = normalizeTenantSlug(typeof input.slug === "string" ? input.slug : "");
  if (slug.length < 2) throw new ApiError(400, "SLUG_INVALIDO", "Informe um identificador válido para o cliente.");
  const duplicate = await database().prepare("SELECT id FROM tenants WHERE slug = ? AND id <> ? LIMIT 1").bind(slug, id).first<{ id: number }>();
  if (duplicate) throw new ApiError(409, "TENANT_DUPLICADO", "Já existe um cliente com este identificador.");
  await database().prepare("UPDATE tenants SET name = ?, slug = ?, updated_at = ? WHERE id = ?").bind(name, slug, nowIso(), id).run();
  const tenant = (await tenantRecord(id))!;
  await writeTenantAudit(context, "TENANT_EDITADO", tenant, { previousName: current.name, previousSlug: current.slug });
  return tenant;
}

export async function setPlatformTenantStatus(request: Request, id: number, status: "ATIVO" | "SUSPENSO" | "CANCELADO"): Promise<TenantRecord> {
  const context = await requirePlatformOwner(request, true);
  const tenant = await tenantRecord(id);
  if (!tenant) throw new ApiError(404, "TENANT_NAO_ENCONTRADO", "Cliente não encontrado.");
  if (!["ATIVO", "SUSPENSO", "CANCELADO"].includes(status)) throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
  if (status !== "ATIVO" && tenant.status === "ATIVO") {
    const units = await database().prepare("SELECT id FROM organizational_units WHERE tenant_id = ?").bind(id).all<{ id: number }>();
    await moveOwnerSessionsAwayFrom(units.results.map((unit) => unit.id));
    await database().prepare("DELETE FROM auth_sessions WHERE tenant_id = ? AND user_id NOT IN (SELECT user_id FROM platform_owners)").bind(id).run();
  }
  await database().prepare("UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?").bind(status, nowIso(), id).run();
  const updated = (await tenantRecord(id))!;
  await writeTenantAudit(context, `TENANT_${status}`, updated, { previousStatus: tenant.status });
  return updated;
}

export async function listPlatformConventions(
  request: Request,
  query: { search?: unknown; status?: unknown; page?: unknown; pageSize?: unknown },
): Promise<PageResult<UnitRecord>> {
  await requirePlatformOwner(request);
  const search = typeof query.search === "string" ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120) : "";
  const status = query.status === "ATIVO" || query.status === "INATIVO" ? query.status : null;
  const conventions = (await allUnits(true)).filter((unit) => {
    if (unit.type !== "CONVENCAO" || unit.archivedAt) return false;
    if (status && unit.status !== status) return false;
    return !search || `${unit.name} ${unit.legalName ?? ""} ${unit.cnpj ?? ""} ${unit.city ?? ""}`.toLocaleLowerCase("pt-BR").includes(search);
  });
  return page(conventions, query.page, query.pageSize);
}

export async function listArchivedUnits(
  request: Request,
  query: { search?: unknown; type?: unknown; page?: unknown; pageSize?: unknown },
): Promise<PageResult<UnitRecord>> {
  await requirePlatformOwner(request);
  const search = typeof query.search === "string" ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120) : "";
  const type = ["CONVENCAO", "MATRIZ", "FILIAL"].includes(String(query.type)) ? query.type as AdminUnitType : null;
  const archived = (await allUnits(true)).filter((unit) => {
    if (!unit.archivedAt || (type && unit.type !== type)) return false;
    return !search || `${unit.name} ${unit.conventionName} ${unit.matrixName ?? ""}`.toLocaleLowerCase("pt-BR").includes(search);
  });
  return page(archived, query.page, query.pageSize);
}

export async function createPlatformConvention(request: Request, input: UnitWriteInput): Promise<UnitRecord> {
  const context = await requirePlatformOwner(request, true);
  const tenantId = Number(input.tenantId);
  const tenant = Number.isInteger(tenantId)
    ? await database().prepare("SELECT status FROM tenants WHERE id = ? LIMIT 1").bind(tenantId).first<{ status: string }>()
    : null;
  if (tenant?.status !== "ATIVO") throw new ApiError(400, "TENANT_INVALIDO", "Selecione um cliente ativo para a nova Convenção.");
  const values = normalizeUnitInput(input);
  assertUniqueUnit(await allUnits(true, tenantId), values.name, "CONVENCAO", null);
  await assertUniqueCnpj(values.cnpj, tenantId);
  const id = generatedId();
  const timestamp = nowIso();
  await database().prepare("INSERT INTO organizational_units (id, tenant_id, type, name, fantasy_name, legal_name, cnpj, phone, whatsapp, email, postal_code, street, number, complement, district, city, state, responsible_name, foundation_date, notes, code, parent_id, status, created_at, updated_at) VALUES (?, ?, 'CONVENCAO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'ATIVO', ?, ?)")
    .bind(id, tenantId, values.name, values.fantasyName, values.legalName, values.cnpj, values.phone, values.whatsapp, values.email, values.postalCode, values.street, values.number, values.complement, values.district, values.city, values.state, values.responsibleName, values.foundationDate, values.notes, platformCode(values.name, id), timestamp, timestamp).run();
  const unit = await unitById("CONVENCAO", id, true, tenantId);
  if (!unit) throw new ApiError(500, "ERRO_INTERNO", "Não foi possível recuperar a Convenção cadastrada.");
  await writePlatformAudit(context, "CONVENCAO_CRIADA", unit, { name: unit.name });
  return unit;
}

export async function updatePlatformConvention(request: Request, id: number, input: UnitWriteInput): Promise<UnitRecord> {
  const context = await requirePlatformOwner(request, true);
  const unit = await unitById("CONVENCAO", id, true);
  if (!unit || unit.archivedAt) throw new ApiError(404, "CONVENCAO_NAO_ENCONTRADA", "Convenção não encontrada.");
  const values = normalizeUnitInput(input);
  assertUniqueUnit(await allUnits(true, unit.tenantId), values.name, "CONVENCAO", null, unit.id);
  await assertUniqueCnpj(values.cnpj, unit.tenantId, unit.id);
  await database().prepare("UPDATE organizational_units SET name = ?, fantasy_name = ?, legal_name = ?, cnpj = ?, phone = ?, whatsapp = ?, email = ?, postal_code = ?, street = ?, number = ?, complement = ?, district = ?, city = ?, state = ?, responsible_name = ?, foundation_date = ?, notes = ?, updated_at = ? WHERE id = ? AND type = 'CONVENCAO'")
    .bind(values.name, values.fantasyName, values.legalName, values.cnpj, values.phone, values.whatsapp, values.email, values.postalCode, values.street, values.number, values.complement, values.district, values.city, values.state, values.responsibleName, values.foundationDate, values.notes, nowIso(), unit.id).run();
  const updated = (await unitById("CONVENCAO", id, true))!;
  await writePlatformAudit(context, "CONVENCAO_EDITADA", updated, { previousName: unit.name, name: updated.name });
  return updated;
}

export async function setPlatformConventionStatus(request: Request, id: number, status: AdminUnitStatus): Promise<UnitRecord> {
  const context = await requirePlatformOwner(request, true);
  const unit = await unitById("CONVENCAO", id, true);
  if (!unit || unit.archivedAt) throw new ApiError(404, "CONVENCAO_NAO_ENCONTRADA", "Convenção não encontrada.");
  if (status === "INATIVO" && unit.status === "ATIVO") await moveOwnerSessionsAwayFrom(await subtreeIds(unit.id));
  await database().prepare("UPDATE organizational_units SET status = ?, updated_at = ? WHERE id = ?").bind(status, nowIso(), unit.id).run();
  const updated = (await unitById("CONVENCAO", id, true))!;
  await writePlatformAudit(context, status === "ATIVO" ? "CONVENCAO_ATIVADA" : "CONVENCAO_DESATIVADA", updated);
  return updated;
}

async function subtreeIds(id: number): Promise<number[]> {
  const root = await unitByAnyId(id, true);
  if (!root) return [];
  const rows = await database().prepare("WITH RECURSIVE subtree(id) AS (SELECT ? UNION ALL SELECT unit.id FROM organizational_units unit JOIN subtree parent ON unit.parent_id = parent.id WHERE unit.tenant_id = ?) SELECT id FROM subtree")
    .bind(id, root.tenantId).all<{ id: number }>();
  return rows.results.map((row) => row.id);
}

async function moveOwnerSessionsAwayFrom(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const fallback = await database().prepare(`SELECT unit.id, unit.tenant_id FROM organizational_units unit JOIN tenants tenant ON tenant.id = unit.tenant_id WHERE unit.type = 'CONVENCAO' AND unit.status = 'ATIVO' AND unit.archived_at IS NULL AND tenant.status = 'ATIVO' AND unit.id NOT IN (${placeholders}) ORDER BY unit.id LIMIT 1`)
    .bind(...ids).first<{ id: number; tenant_id: number }>();
  if (!fallback) throw new ApiError(409, "ULTIMA_CONVENCAO_ATIVA", "Cadastre e ative outra Convenção antes de arquivar esta unidade.");
  await database().prepare(`UPDATE auth_sessions SET tenant_id = ?, selected_unit_id = ? WHERE user_id IN (SELECT user_id FROM platform_owners) AND selected_unit_id IN (${placeholders})`)
    .bind(fallback.tenant_id, fallback.id, ...ids).run();
}

export async function archivePlatformUnit(request: Request, type: AdminUnitType, id: number): Promise<UnitRecord> {
  const context = await requirePlatformOwner(request, true);
  const unit = await unitById(type, id, true);
  if (!unit) throw new ApiError(404, "UNIDADE_NAO_ENCONTRADA", "Unidade não encontrada.");
  if (unit.archivedAt) throw new ApiError(409, "UNIDADE_JA_ARQUIVADA", "Esta unidade já está arquivada.");
  if (!canArchiveEntity(unit.status)) {
    throw new ApiError(400, "UNIDADE_DEVE_ESTAR_INATIVA", "Desative a unidade antes de arquivá-la.");
  }
  const ids = await subtreeIds(unit.id);
  await moveOwnerSessionsAwayFrom(ids);
  const placeholders = ids.map(() => "?").join(",");
  const timestamp = nowIso();
  const archiveState = archivedUnitState(unit.status);
  await database().batch([
    database().prepare("UPDATE organizational_units SET archived_at = ?, archived_by = ?, archived_previous_status = ?, status = ?, updated_at = ? WHERE id = ?").bind(timestamp, context.session.user.id, archiveState.previousStatus, archiveState.status, timestamp, unit.id),
    database().prepare(`DELETE FROM auth_sessions WHERE user_id NOT IN (SELECT user_id FROM platform_owners) AND (selected_unit_id IN (${placeholders}) OR membership_id IN (SELECT id FROM tenant_memberships WHERE scope_unit_id IN (${placeholders})))`).bind(...ids, ...ids),
  ]);
  const archived = (await unitById(type, id, true))!;
  await writePlatformAudit(context, "UNIDADE_ARQUIVADA", archived, { previousStatus: unit.status, subtreeSize: ids.length });
  return archived;
}

export async function restorePlatformUnit(request: Request, type: AdminUnitType, id: number): Promise<UnitRecord> {
  const context = await requirePlatformOwner(request, true);
  const unit = await unitById(type, id, true);
  if (!unit || !unit.archivedAt) throw new ApiError(404, "UNIDADE_ARQUIVADA_NAO_ENCONTRADA", "Unidade arquivada não encontrada.");
  if (unit.type !== "CONVENCAO") {
    const parentId = unit.type === "MATRIZ" ? unit.conventionId : unit.matrixId;
    const parent = parentId ? await unitByAnyId(parentId, true) : null;
    if (!parent || parent.archivedAt || parent.status !== "ATIVO") {
      throw new ApiError(409, "VINCULO_SUPERIOR_INDISPONIVEL", "Restaure e ative primeiro a unidade superior.");
    }
  }
  const restoredStatus = restoredUnitStatus(unit.archivedPreviousStatus);
  await database().prepare("UPDATE organizational_units SET archived_at = NULL, archived_by = NULL, archived_previous_status = NULL, status = ?, updated_at = ? WHERE id = ?")
    .bind(restoredStatus, nowIso(), unit.id).run();
  const restored = (await unitById(type, id, true))!;
  await writePlatformAudit(context, "UNIDADE_RESTAURADA", restored, { restoredStatus });
  return restored;
}

async function unitDependencies(unit: UnitRecord): Promise<DeletionDependency[]> {
  return compactDependencies([
    { source: "organizational_units.parent_id", label: "unidades subordinadas", count: await count("WITH RECURSIVE descendants(id) AS (SELECT id FROM organizational_units WHERE parent_id = ? UNION ALL SELECT unit.id FROM organizational_units unit JOIN descendants parent ON unit.parent_id = parent.id) SELECT COUNT(*) AS total FROM descendants", unit.id) },
    { source: "tenant_memberships.scope_unit_id", label: "vínculos de usuários", count: await count("SELECT COUNT(*) AS total FROM tenant_memberships WHERE scope_unit_id = ?", unit.id) },
    { source: "auth_sessions.selected_unit_id", label: "sessões", count: await count("SELECT COUNT(*) AS total FROM auth_sessions WHERE selected_unit_id = ?", unit.id) },
    { source: "administration_audit.unit_id", label: "registros históricos", count: await count("SELECT COUNT(*) AS total FROM administration_audit WHERE unit_id = ? OR convention_id = ?", unit.id, unit.id) },
  ]);
}

export async function assessPlatformUnitDeletion(request: Request, type: AdminUnitType, id: number): Promise<DeletionAssessment> {
  await requirePlatformOwner(request);
  const unit = await unitById(type, id, true);
  if (!unit) throw new ApiError(404, "UNIDADE_NAO_ENCONTRADA", "Unidade não encontrada.");
  if (!unit.archivedAt) throw new ApiError(400, "UNIDADE_NAO_ARQUIVADA", "Somente uma unidade arquivada pode ser excluída definitivamente.");
  const dependencies = await unitDependencies(unit);
  return { canDelete: !hasBlockingDependencies(dependencies), dependencies, summary: dependencySummary(unit.type === "FILIAL" ? "Filial" : unit.type === "MATRIZ" ? "Matriz" : "Convenção", unit.name, dependencies) };
}

export async function permanentlyDeletePlatformUnit(
  request: Request,
  type: AdminUnitType,
  id: number,
  input: { password: string; confirmation: string },
): Promise<void> {
  const context = await requirePlatformOwner(request, true);
  const unit = await unitById(type, id, true);
  if (!unit) throw new ApiError(404, "UNIDADE_NAO_ENCONTRADA", "Unidade não encontrada.");
  if (!unit.archivedAt) throw new ApiError(400, "UNIDADE_NAO_ARQUIVADA", "Somente uma unidade arquivada pode ser excluída definitivamente.");
  try {
    await verifyUserPassword(context.session.user.id, input.password);
  } catch (error) {
    await writePlatformAudit(context, "TENTATIVA_EXCLUSAO_UNIDADE_BLOQUEADA", unit, { name: unit.name, result: "BLOQUEADA", reason: "SENHA_INVALIDA" });
    throw error;
  }
  if (input.confirmation.trim() !== permanentDeletionPhrase(unit.name)) {
    await writePlatformAudit(context, "TENTATIVA_EXCLUSAO_UNIDADE_BLOQUEADA", unit, { name: unit.name, result: "BLOQUEADA", reason: "CONFIRMACAO_INVALIDA" });
    throw new ApiError(400, "CONFIRMACAO_INVALIDA", `Digite exatamente: ${permanentDeletionPhrase(unit.name)}`);
  }
  const dependencies = await unitDependencies(unit);
  if (hasBlockingDependencies(dependencies)) {
    await writePlatformAudit(context, "TENTATIVA_EXCLUSAO_UNIDADE_BLOQUEADA", unit, { name: unit.name, result: "BLOQUEADA", reason: "UNIDADE_COM_DEPENDENCIAS", dependencies });
    throw new ApiError(409, "UNIDADE_COM_DEPENDENCIAS", dependencySummary(unit.type === "FILIAL" ? "Filial" : unit.type === "MATRIZ" ? "Matriz" : "Convenção", unit.name, dependencies));
  }
  const timestamp = nowIso();
  await database().batch([
    database().prepare("DELETE FROM unit_logos WHERE unit_id = ?").bind(unit.id),
    database().prepare("DELETE FROM organizational_units WHERE id = ?").bind(unit.id),
    database().prepare("INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, convention_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, 'UNIDADE_EXCLUIDA_DEFINITIVAMENTE', 'UNIDADE', ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(context.session.user.id, unit.tenantId, unit.id, unit.conventionId, unit.id, context.metadata.ipAddress, context.metadata.userAgent, context.metadata.deviceSummary, JSON.stringify({ name: unit.name, type: unit.type, result: "SUCESSO" }), timestamp),
  ]);
}

type PlatformUserRow = {
  id: number;
  identity_id: number;
  tenant_id: number;
  name: string;
  username: string;
  email: string;
  cpf: string;
  role_name: string;
  scope: "CONVENCAO" | "MATRIZ" | "FILIAL";
  status: "ATIVO" | "INATIVO" | "PENDENTE";
  must_change_password: number;
  archived_at: string | null;
  archived_by: number | null;
  archived_by_name: string | null;
  archived_previous_status: "ATIVO" | "INATIVO" | "PENDENTE" | null;
  scope_unit_id: number;
  scope_unit_name: string;
  scope_unit_type: AdminUnitType;
  parent_id: number | null;
  parent_name: string | null;
  grandparent_id: number | null;
  last_login_at: string | null;
  profile_photo_updated_at: string | null;
  created_at: string;
  updated_at: string;
  is_platform_owner: number;
};

const PLATFORM_USER_SELECT = `
  SELECT membership.id, u.id AS identity_id, membership.tenant_id, membership.display_name AS name,
    u.username, u.email, u.cpf, membership.role_name, membership.scope, membership.status,
    u.must_change_password, membership.archived_at,
    membership.archived_by_membership_id AS archived_by, membership.archived_previous_status,
    archiver.name AS archived_by_name, scope_unit.id AS scope_unit_id,
    scope_unit.name AS scope_unit_name, scope_unit.type AS scope_unit_type,
    parent.id AS parent_id, parent.name AS parent_name, grandparent.id AS grandparent_id,
    (SELECT MAX(history.created_at) FROM login_history history WHERE history.user_id = u.id AND history.success = 1) AS last_login_at,
    (SELECT photo.updated_at FROM user_profile_photos photo WHERE photo.user_id = u.id) AS profile_photo_updated_at,
    membership.created_at, membership.updated_at,
    EXISTS(SELECT 1 FROM platform_owners owner WHERE owner.user_id = u.id) AS is_platform_owner
  FROM tenant_memberships membership
  JOIN auth_users u ON u.id = membership.user_id
  JOIN organizational_units scope_unit ON scope_unit.id = membership.scope_unit_id AND scope_unit.tenant_id = membership.tenant_id
  LEFT JOIN organizational_units parent ON parent.id = scope_unit.parent_id AND parent.tenant_id = membership.tenant_id
  LEFT JOIN organizational_units grandparent ON grandparent.id = parent.parent_id AND grandparent.tenant_id = membership.tenant_id
  LEFT JOIN tenant_memberships archiver_membership ON archiver_membership.id = membership.archived_by_membership_id
  LEFT JOIN auth_users archiver ON archiver.id = archiver_membership.user_id
`;

async function platformUserById(id: number): Promise<PlatformUserRow | null> {
  return database().prepare(`${PLATFORM_USER_SELECT} WHERE membership.id = ? LIMIT 1`).bind(id).first<PlatformUserRow>();
}

function userConventionId(row: PlatformUserRow): number {
  return row.scope_unit_type === "CONVENCAO" ? row.scope_unit_id : row.scope_unit_type === "MATRIZ" ? row.parent_id ?? 0 : row.grandparent_id ?? 0;
}

async function mapPlatformUser(row: PlatformUserRow): Promise<UserRecord> {
  const permissions = await database().prepare("SELECT permission FROM membership_permissions WHERE membership_id = ? ORDER BY permission").bind(row.id).all<{ permission: UserRecord["permissions"][number] }>();
  return {
    id: row.id,
    identityId: row.identity_id,
    tenantId: row.tenant_id,
    conventionId: userConventionId(row),
    name: row.name,
    username: row.username,
    email: row.email,
    cpf: row.cpf,
    cpfHint: `***.***.***-${row.cpf.slice(-2)}`,
    roleName: row.role_name,
    scope: row.scope,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
    boundMatrixId: row.scope === "MATRIZ" ? row.scope_unit_id : null,
    boundBranchId: row.scope === "FILIAL" ? row.scope_unit_id : null,
    branchMatrixId: row.scope === "FILIAL" ? row.parent_id : null,
    matrixName: row.scope === "MATRIZ" ? row.scope_unit_name : row.scope === "FILIAL" ? row.parent_name : null,
    branchName: row.scope === "FILIAL" ? row.scope_unit_name : null,
    permissions: permissions.results.map((item) => item.permission),
    activeSessions: 0,
    lastLoginAt: row.last_login_at,
    profilePhotoUrl: row.profile_photo_updated_at ? `/api/media/users/${row.identity_id}/profile-photo?v=${encodeURIComponent(row.profile_photo_updated_at)}` : null,
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    archivedByName: row.archived_by_name,
    archivedPreviousStatus: row.archived_previous_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function writeUserPlatformAudit(context: PlatformContext, action: string, user: PlatformUserRow, details: Record<string, unknown> = {}): Promise<void> {
  await database().prepare("INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, convention_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, ?, 'USUARIO', ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(context.session.user.id, user.tenant_id, action, user.id, userConventionId(user), user.scope_unit_id, context.metadata.ipAddress, context.metadata.userAgent, context.metadata.deviceSummary, JSON.stringify({ name: user.name, ...details }), nowIso()).run();
}

export async function listArchivedPlatformUsers(request: Request, query: { search?: unknown; scope?: unknown; page?: unknown; pageSize?: unknown }): Promise<PageResult<UserRecord>> {
  await requirePlatformOwner(request);
  const search = typeof query.search === "string" ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120) : "";
  const scope = ["CONVENCAO", "MATRIZ", "FILIAL"].includes(String(query.scope)) ? String(query.scope) : null;
  const rows = await database().prepare(`${PLATFORM_USER_SELECT} WHERE membership.archived_at IS NOT NULL ORDER BY membership.archived_at DESC`).all<PlatformUserRow>();
  const filtered = rows.results.filter((row) => !row.is_platform_owner && (!scope || row.scope === scope) && (!search || `${row.name} ${row.username} ${row.email} ${row.scope_unit_name}`.toLocaleLowerCase("pt-BR").includes(search)));
  return page(await Promise.all(filtered.map(mapPlatformUser)), query.page, query.pageSize);
}

export async function archivePlatformUser(request: Request, id: number): Promise<UserRecord> {
  const context = await requirePlatformOwner(request, true);
  const user = await platformUserById(id);
  if (!user) throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.");
  if (!canDeleteOwnAccount(context.session.user.id, user.identity_id)) throw new ApiError(409, "AUTOEXCLUSAO_BLOQUEADA", "Você não pode arquivar a própria conta enquanto está conectado.");
  if (user.is_platform_owner) throw new ApiError(409, "PLATFORM_OWNER_PROTEGIDO", "A conta do proprietário da plataforma não pode ser arquivada.");
  if (user.archived_at) throw new ApiError(409, "USUARIO_JA_ARQUIVADO", "Este usuário já está arquivado.");
  if (user.status !== "INATIVO" || !canArchiveEntity(user.status)) throw new ApiError(400, "USUARIO_DEVE_ESTAR_INATIVO", "Desative o vínculo antes de arquivá-lo.");
  const timestamp = nowIso();
  await database().batch([
    database().prepare("UPDATE tenant_memberships SET archived_at = ?, archived_by_membership_id = NULL, archived_previous_status = status, status = 'INATIVO', updated_at = ? WHERE id = ?").bind(timestamp, timestamp, user.id),
    database().prepare("DELETE FROM auth_sessions WHERE membership_id = ?").bind(user.id),
    database().prepare("INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, convention_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, 'USUARIO_ARQUIVADO', 'USUARIO', ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(context.session.user.id, user.tenant_id, user.id, userConventionId(user), user.scope_unit_id, context.metadata.ipAddress, context.metadata.userAgent, context.metadata.deviceSummary, JSON.stringify({ name: user.name, result: "SUCESSO" }), timestamp),
  ]);
  return mapPlatformUser((await platformUserById(user.id))!);
}

export async function restorePlatformUser(request: Request, id: number): Promise<UserRecord> {
  const context = await requirePlatformOwner(request, true);
  const user = await platformUserById(id);
  if (!user || !user.archived_at) throw new ApiError(404, "USUARIO_ARQUIVADO_NAO_ENCONTRADO", "Usuário arquivado não encontrado.");
  const binding = await unitById(user.scope_unit_type, user.scope_unit_id);
  if (!binding || binding.status !== "ATIVO") throw new ApiError(409, "VINCULO_INATIVO", "Restaure e ative a unidade vinculada antes de restaurar este usuário.");
  const restoredStatus = user.archived_previous_status === "ATIVO" ? "ATIVO" : "INATIVO";
  await database().prepare("UPDATE tenant_memberships SET archived_at = NULL, archived_by_membership_id = NULL, archived_previous_status = NULL, status = ?, updated_at = ? WHERE id = ?").bind(restoredStatus, nowIso(), user.id).run();
  const restored = (await platformUserById(user.id))!;
  await writeUserPlatformAudit(context, "USUARIO_RESTAURADO", restored, { result: "SUCESSO", restoredStatus });
  return mapPlatformUser(restored);
}

async function userDependencies(user: PlatformUserRow): Promise<DeletionDependency[]> {
  return compactDependencies([
    { source: "login_history.user_id", label: "registros de acesso", count: await count("SELECT COUNT(*) AS total FROM login_history WHERE user_id = ? AND tenant_id = ?", user.identity_id, user.tenant_id) },
    { source: "audit_logs.user_id", label: "eventos de segurança", count: await count("SELECT COUNT(*) AS total FROM audit_logs WHERE user_id = ? AND tenant_id = ?", user.identity_id, user.tenant_id) },
    { source: "administration_audit.actor_membership_id", label: "operações administrativas", count: await count("SELECT COUNT(*) AS total FROM administration_audit WHERE actor_membership_id = ?", user.id) },
    { source: "auth_sessions.membership_id", label: "sessões", count: await count("SELECT COUNT(*) AS total FROM auth_sessions WHERE membership_id = ?", user.id) },
  ]);
}

export async function assessPlatformUserDeletion(request: Request, id: number): Promise<DeletionAssessment> {
  const context = await requirePlatformOwner(request);
  const user = await platformUserById(id);
  if (!user) throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.");
  if (!canDeleteOwnAccount(context.session.user.id, user.identity_id)) throw new ApiError(409, "AUTOEXCLUSAO_BLOQUEADA", "Você não pode excluir a própria conta.");
  if (user.is_platform_owner) throw new ApiError(409, "PLATFORM_OWNER_PROTEGIDO", "A única conta de recuperação administrativa não pode ser excluída.");
  if (!user.archived_at) throw new ApiError(400, "USUARIO_NAO_ARQUIVADO", "Somente um usuário arquivado pode ser excluído definitivamente.");
  const dependencies = await userDependencies(user);
  return { canDelete: !hasBlockingDependencies(dependencies), dependencies, summary: dependencySummary("Usuário", user.name, dependencies) };
}

export async function permanentlyDeletePlatformUser(request: Request, id: number, input: { password: string; confirmation: string }): Promise<void> {
  const context = await requirePlatformOwner(request, true);
  const user = await platformUserById(id);
  if (!user) throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.");
  if (!canDeleteOwnAccount(context.session.user.id, user.identity_id)) throw new ApiError(409, "AUTOEXCLUSAO_BLOQUEADA", "Você não pode excluir a própria conta enquanto está conectado.");
  if (user.is_platform_owner) throw new ApiError(409, "PLATFORM_OWNER_PROTEGIDO", "A conta necessária para recuperação administrativa não pode ser excluída.");
  if (!user.archived_at) throw new ApiError(400, "USUARIO_NAO_ARQUIVADO", "Somente um usuário arquivado pode ser excluído definitivamente.");
  try {
    await verifyUserPassword(context.session.user.id, input.password);
  } catch (error) {
    await writeUserPlatformAudit(context, "TENTATIVA_EXCLUSAO_USUARIO_BLOQUEADA", user, { result: "BLOQUEADA", reason: "SENHA_INVALIDA" });
    throw error;
  }
  if (input.confirmation.trim() !== userPermanentDeletionPhrase(user.name)) {
    await writeUserPlatformAudit(context, "TENTATIVA_EXCLUSAO_USUARIO_BLOQUEADA", user, { result: "BLOQUEADA", reason: "CONFIRMACAO_INVALIDA" });
    throw new ApiError(400, "CONFIRMACAO_INVALIDA", `Digite exatamente: ${userPermanentDeletionPhrase(user.name)}`);
  }
  const dependencies = await userDependencies(user);
  if (hasBlockingDependencies(dependencies)) {
    await writeUserPlatformAudit(context, "TENTATIVA_EXCLUSAO_USUARIO_BLOQUEADA", user, { result: "BLOQUEADA", reason: "USUARIO_COM_DEPENDENCIAS", dependencies });
    throw new ApiError(409, "USUARIO_COM_DEPENDENCIAS", dependencySummary("Usuário", user.name, dependencies));
  }
  const timestamp = nowIso();
  await database().batch([
    database().prepare("DELETE FROM auth_sessions WHERE membership_id = ?").bind(user.id),
    database().prepare("DELETE FROM membership_permissions WHERE membership_id = ?").bind(user.id),
    database().prepare("DELETE FROM tenant_memberships WHERE id = ?").bind(user.id),
    database().prepare("DELETE FROM user_profile_photos WHERE user_id = ?").bind(user.identity_id),
    database().prepare("DELETE FROM user_permissions WHERE user_id = ?").bind(user.identity_id),
    database().prepare("DELETE FROM user_unit_links WHERE user_id = ?").bind(user.identity_id),
    database().prepare("DELETE FROM auth_users WHERE id = ? AND tenant_id = ? AND NOT EXISTS (SELECT 1 FROM tenant_memberships WHERE user_id = ?)")
      .bind(user.identity_id, user.tenant_id, user.identity_id),
    database().prepare("INSERT INTO platform_audit (actor_user_id, tenant_id, action, entity_type, entity_id, convention_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, 'USUARIO_EXCLUIDO_DEFINITIVAMENTE', 'USUARIO', ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(context.session.user.id, user.tenant_id, user.id, userConventionId(user), user.scope_unit_id, context.metadata.ipAddress, context.metadata.userAgent, context.metadata.deviceSummary, JSON.stringify({ name: user.name, result: "SUCESSO" }), timestamp),
  ]);
}

import bcrypt from "bcryptjs";
import {
  ApiError,
  administrativeSession,
  assertTrustedOrigin,
  database,
  requestMetadata,
} from "@/lib/server/auth";
import {
  isPasswordValid,
  PASSWORD_POLICY_MESSAGE,
} from "@/lib/password-policy";
import {
  normalizeBrazilianState,
  normalizeCnpj,
  normalizeDigits,
  normalizeEmail,
  normalizeLoginIdentifier,
  normalizeOptionalText,
  normalizePhone,
} from "@/lib/server/validation";
import type {
  AdministrativeSession,
  OrganizationalScope,
  RequestMetadata,
} from "@/lib/types";
import {
  PERMISSION_DEFINITIONS,
  isPermissionCode,
  type PermissionCode,
} from "@/lib/admin/permissions";
import type {
  AccessHistoryRecord,
  AccessResult,
  AdminBootstrap,
  AdminUnitStatus,
  AdminUnitType,
  PageResult,
  UnitRecord,
  UnitWriteInput,
  UserRecord,
  UserWriteInput,
} from "@/lib/admin/types";
import {
  canAdministerUnit,
  canAdministerUser as canAdministerUserTarget,
  canReadUnitLogo,
} from "@/lib/admin/policy";
import { unitLogoUrl, userPhotoUrl } from "@/lib/image-policy";
import {
  removeUnitLogo,
  removeUserPhoto,
  saveUnitLogo,
  saveUserPhoto,
  type ValidatedImageUpload,
} from "@/lib/server/media";
import { canInheritCnpj } from "@/lib/unit/cnpj-policy";
import { canUseOrganizationalAdministration } from "@/lib/platform/policy";

type UnitRow = {
  id: number;
  tenant_id: number;
  type: AdminUnitType;
  name: string;
  fantasy_name: string | null;
  legal_name: string | null;
  cnpj: string | null;
  own_cnpj: string | null;
  parent_cnpj: string | null;
  uses_parent_cnpj: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postal_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  responsible_name: string | null;
  foundation_date: string | null;
  notes: string | null;
  status: AdminUnitStatus;
  parent_id: number | null;
  convention_id: number;
  convention_name: string;
  matrix_id: number | null;
  matrix_name: string | null;
  parent_name: string | null;
  created_at: string;
  updated_at: string;
  logo_updated_at: string | null;
  archived_at: string | null;
  archived_by: number | null;
  archived_by_name: string | null;
  archived_previous_status: AdminUnitStatus | null;
};

type UserRow = {
  id: number;
  identity_id: number;
  tenant_id: number;
  name: string;
  username: string;
  email: string;
  cpf: string;
  role_name: string;
  function_id: number | null;
  scope: OrganizationalScope;
  status: "ATIVO" | "INATIVO" | "PENDENTE";
  must_change_password: number;
  blocked_until: string | null;
  archived_at: string | null;
  archived_by: number | null;
  archived_by_name: string | null;
  archived_previous_status: "ATIVO" | "INATIVO" | "PENDENTE" | null;
  created_at: string;
  updated_at: string;
  scope_unit_id: number;
  scope_unit_name: string;
  scope_unit_type: AdminUnitType;
  scope_unit_status: AdminUnitStatus;
  scope_unit_archived_at: string | null;
  parent_id: number | null;
  parent_name: string | null;
  parent_status: AdminUnitStatus | null;
  parent_archived_at: string | null;
  grandparent_id: number | null;
  grandparent_name: string | null;
  grandparent_status: AdminUnitStatus | null;
  grandparent_archived_at: string | null;
  active_sessions: number;
  last_login_at: string | null;
  profile_photo_updated_at: string | null;
  is_platform_owner: number;
};

const OPERATIONAL_UNIT_FILTER =
  "target.archived_at IS NULL AND (target.type = 'CONVENCAO' OR parent.archived_at IS NULL) AND (target.type <> 'FILIAL' OR grandparent.archived_at IS NULL)";

const UNIT_SELECT = `
  SELECT target.id, target.tenant_id, target.type, target.name, target.fantasy_name, target.legal_name,
    CASE WHEN target.type = 'FILIAL' AND target.uses_parent_cnpj = 1 THEN parent.cnpj ELSE target.cnpj END AS cnpj,
    target.cnpj AS own_cnpj, parent.cnpj AS parent_cnpj, target.uses_parent_cnpj,
    target.phone, target.whatsapp, target.email, target.postal_code,
    target.street, target.number, target.complement, target.district, target.city,
    target.state, target.responsible_name, target.foundation_date, target.notes,
    target.status, target.parent_id, target.archived_at, target.archived_by,
    target.archived_previous_status, archiver.name AS archived_by_name,
    CASE target.type
      WHEN 'CONVENCAO' THEN target.id
      WHEN 'MATRIZ' THEN parent.id
      ELSE grandparent.id
    END AS convention_id,
    CASE target.type
      WHEN 'CONVENCAO' THEN target.name
      WHEN 'MATRIZ' THEN parent.name
      ELSE grandparent.name
    END AS convention_name,
    CASE target.type
      WHEN 'MATRIZ' THEN target.id
      WHEN 'FILIAL' THEN parent.id
      ELSE NULL
    END AS matrix_id,
    CASE target.type
      WHEN 'MATRIZ' THEN target.name
      WHEN 'FILIAL' THEN parent.name
      ELSE NULL
    END AS matrix_name,
    parent.name AS parent_name,
    target.created_at, target.updated_at,
    (SELECT logo.updated_at FROM unit_logos logo WHERE logo.unit_id = target.id) AS logo_updated_at
  FROM organizational_units target
  LEFT JOIN organizational_units parent ON parent.id = target.parent_id AND parent.tenant_id = target.tenant_id
  LEFT JOIN organizational_units grandparent ON grandparent.id = parent.parent_id AND grandparent.tenant_id = target.tenant_id
  LEFT JOIN auth_users archiver ON archiver.id = target.archived_by
`;

const USER_SELECT = `
  SELECT membership.id, u.id AS identity_id, membership.tenant_id, membership.display_name AS name,
    u.username, u.email, u.cpf, COALESCE(org_function.name, membership.role_name) AS role_name,
    membership.function_id, membership.scope, membership.status,
    u.must_change_password, u.blocked_until, membership.archived_at,
    membership.archived_by_membership_id AS archived_by,
    membership.archived_previous_status, archiver.name AS archived_by_name,
    membership.created_at, membership.updated_at,
    scope_unit.id AS scope_unit_id, scope_unit.name AS scope_unit_name,
    scope_unit.type AS scope_unit_type, scope_unit.status AS scope_unit_status, scope_unit.archived_at AS scope_unit_archived_at,
    parent.id AS parent_id, parent.name AS parent_name, parent.status AS parent_status, parent.archived_at AS parent_archived_at,
    grandparent.id AS grandparent_id, grandparent.name AS grandparent_name,
    grandparent.status AS grandparent_status, grandparent.archived_at AS grandparent_archived_at,
    (SELECT COUNT(*) FROM auth_sessions session
      WHERE session.membership_id = membership.id AND session.expires_at > ?) AS active_sessions,
    (SELECT MAX(history.created_at) FROM login_history history
      WHERE history.user_id = u.id AND history.success = 1) AS last_login_at,
    (SELECT photo.updated_at FROM user_profile_photos photo WHERE photo.user_id = u.id) AS profile_photo_updated_at,
    EXISTS(SELECT 1 FROM platform_owners owner WHERE owner.user_id = u.id) AS is_platform_owner
  FROM tenant_memberships membership
  JOIN auth_users u ON u.id = membership.user_id AND u.archived_at IS NULL
  JOIN organizational_units scope_unit ON scope_unit.id = membership.scope_unit_id AND scope_unit.tenant_id = membership.tenant_id
  LEFT JOIN organizational_units parent ON parent.id = scope_unit.parent_id AND parent.tenant_id = membership.tenant_id
  LEFT JOIN organizational_units grandparent ON grandparent.id = parent.parent_id AND grandparent.tenant_id = membership.tenant_id
  LEFT JOIN tenant_memberships archiver_membership ON archiver_membership.id = membership.archived_by_membership_id
  LEFT JOIN auth_users archiver ON archiver.id = archiver_membership.user_id
  LEFT JOIN organizational_functions org_function ON org_function.id = membership.function_id AND org_function.tenant_id = membership.tenant_id
`;

function nowIso(): string {
  return new Date().toISOString();
}

export function generatedId(): number {
  const suffix = crypto.getRandomValues(new Uint32Array(1))[0] % 1000;
  return Date.now() * 1000 + suffix;
}

function cleanText(value: unknown, label: string, max: number): string {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (normalized.length < 2 || normalized.length > max) {
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      `${label} deve ter entre 2 e ${max} caracteres.`,
    );
  }
  return normalized;
}

type NormalizedUnitValues = Omit<UnitWriteInput, "type" | "matrixId"> & {
  name: string;
  fantasyName: string | null;
  legalName: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  responsibleName: string | null;
  foundationDate: string | null;
  notes: string | null;
};

export function normalizeUnitInput(
  input: UnitWriteInput,
): NormalizedUnitValues {
  const optional = (
    value: unknown,
    label: string,
    max: number,
  ): string | null => {
    if (typeof value === "string" && value.trim().length > max) {
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        `${label} deve ter no máximo ${max} caracteres.`,
      );
    }
    return normalizeOptionalText(value, max);
  };
  const rawCnpj = typeof input.cnpj === "string" ? input.cnpj.trim() : "";
  const cnpj = normalizeCnpj(rawCnpj);
  if (rawCnpj && !cnpj)
    throw new ApiError(400, "CNPJ_INVALIDO", "Informe um CNPJ válido.");

  const rawPostalCode =
    typeof input.postalCode === "string" ? input.postalCode.trim() : "";
  const postalCode = normalizeDigits(rawPostalCode);
  if (rawPostalCode && (!postalCode || postalCode.length !== 8)) {
    throw new ApiError(400, "CEP_INVALIDO", "O CEP deve conter 8 dígitos.");
  }

  const rawEmail = typeof input.email === "string" ? input.email.trim() : "";
  const email = normalizeEmail(rawEmail);
  if (rawEmail && !email)
    throw new ApiError(400, "EMAIL_INVALIDO", "Informe um e-mail válido.");

  const rawState = typeof input.state === "string" ? input.state.trim() : "";
  const state = normalizeBrazilianState(rawState);
  if (rawState && !state)
    throw new ApiError(400, "UF_INVALIDA", "Informe uma UF brasileira válida.");

  const rawPhone = typeof input.phone === "string" ? input.phone.trim() : "";
  const phone = normalizePhone(rawPhone);
  if (rawPhone && !phone)
    throw new ApiError(
      400,
      "TELEFONE_INVALIDO",
      "Informe um telefone com DDD.",
    );

  const rawWhatsapp =
    typeof input.whatsapp === "string" ? input.whatsapp.trim() : "";
  const whatsapp = normalizePhone(rawWhatsapp);
  if (rawWhatsapp && !whatsapp)
    throw new ApiError(
      400,
      "WHATSAPP_INVALIDO",
      "Informe um WhatsApp com DDD.",
    );

  const foundationDate = optional(
    input.foundationDate,
    "A data de fundação",
    10,
  );
  if (foundationDate) {
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(foundationDate)
      ? new Date(`${foundationDate}T00:00:00.000Z`)
      : null;
    if (
      !parsedDate ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== foundationDate
    ) {
      throw new ApiError(
        400,
        "DATA_INVALIDA",
        "Informe uma data de fundação válida.",
      );
    }
  }

  return {
    name: cleanText(input.name, "O nome da unidade", 150),
    fantasyName: optional(input.fantasyName, "O nome fantasia", 150),
    legalName: optional(input.legalName, "A razão social", 180),
    cnpj,
    phone,
    whatsapp,
    email,
    postalCode,
    street: optional(input.street, "O logradouro", 180),
    number: optional(input.number, "O número", 30),
    complement: optional(input.complement, "O complemento", 120),
    district: optional(input.district, "O bairro", 120),
    city: optional(input.city, "A cidade", 120),
    state,
    responsibleName: optional(input.responsibleName, "O responsável", 150),
    foundationDate,
    notes: optional(input.notes, "As observações", 1000),
  };
}

export async function assertUniqueCnpj(
  cnpj: string | null,
  tenantId: number,
  excludedId?: number,
): Promise<void> {
  if (!cnpj) return;
  const duplicate = await database()
    .prepare(
      "SELECT id FROM organizational_units WHERE tenant_id = ? AND cnpj = ? AND uses_parent_cnpj = 0 AND (? IS NULL OR id <> ?) LIMIT 1",
    )
    .bind(tenantId, cnpj, excludedId ?? null, excludedId ?? null)
    .first<{ id: number }>();
  if (duplicate)
    throw new ApiError(
      409,
      "CNPJ_DUPLICADO",
      "Este CNPJ já está vinculado a outra unidade.",
    );
}

function cleanPage(value: unknown, fallback = 1, max?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function paginate<T>(
  items: T[],
  pageInput: unknown,
  pageSizeInput: unknown,
): PageResult<T> {
  const pageSize = cleanPage(pageSizeInput, 10, 50);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(cleanPage(pageInput), totalPages);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function permissionsFor(
  membershipId: number | null,
  identityId?: number,
): Promise<PermissionCode[]> {
  if (membershipId === null) {
    if (!identityId) return [];
    const legacy = await database()
      .prepare(
        "SELECT permission FROM user_permissions WHERE user_id = ? ORDER BY permission",
      )
      .bind(identityId)
      .all<{ permission: string }>();
    return legacy.results.map((row) => row.permission).filter(isPermissionCode);
  }
  const result = await database()
    .prepare(
      "SELECT permission FROM membership_permissions WHERE membership_id = ? ORDER BY permission",
    )
    .bind(membershipId)
    .all<{ permission: string }>();
  return result.results.map((row) => row.permission).filter(isPermissionCode);
}

export async function requirePermission(
  request: Request,
  permission: PermissionCode,
): Promise<{
  session: AdministrativeSession;
  permissions: Set<PermissionCode>;
  metadata: RequestMetadata;
}> {
  const session = await administrativeSession(request);
  if (
    !canUseOrganizationalAdministration(
      session.user.isPlatformOwner,
      Boolean(session.user.platformTenantContextActive),
    )
  ) {
    throw new ApiError(
      403,
      "CONTEXTO_TENANT_NECESSARIO",
      "Selecione um cliente em Administração do NexIgreja antes de acessar dados organizacionais.",
    );
  }
  if (session.user.mustChangePassword) {
    throw new ApiError(
      403,
      "TROCA_SENHA_OBRIGATORIA",
      "Troque a senha temporária antes de acessar a administração.",
    );
  }
  const permissions = new Set(
    await permissionsFor(session.user.membershipId, session.user.id),
  );
  if (!permissions.has(permission)) {
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "Você não possui permissão para realizar esta operação.",
    );
  }
  return { session, permissions, metadata: requestMetadata(request) };
}

export async function requireAnyPermission(
  request: Request,
  required: readonly PermissionCode[],
): Promise<{
  session: AdministrativeSession;
  permissions: Set<PermissionCode>;
  metadata: RequestMetadata;
}> {
  const session = await administrativeSession(request);
  if (
    !canUseOrganizationalAdministration(
      session.user.isPlatformOwner,
      Boolean(session.user.platformTenantContextActive),
    )
  ) {
    throw new ApiError(
      403,
      "CONTEXTO_TENANT_NECESSARIO",
      "Selecione um cliente em Administração do NexIgreja antes de acessar dados organizacionais.",
    );
  }
  if (session.user.mustChangePassword) {
    throw new ApiError(
      403,
      "TROCA_SENHA_OBRIGATORIA",
      "Troque a senha temporária antes de acessar a administração.",
    );
  }
  const permissions = new Set(
    await permissionsFor(session.user.membershipId, session.user.id),
  );
  if (!required.some((permission) => permissions.has(permission))) {
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "Você não possui permissão para realizar esta operação.",
    );
  }
  return { session, permissions, metadata: requestMetadata(request) };
}

function mapUnit(row: UnitRow): UnitRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    name: row.name,
    fantasyName: row.fantasy_name,
    legalName: row.legal_name,
    cnpj: row.cnpj,
    ownCnpj: row.own_cnpj,
    parentCnpj: row.parent_cnpj,
    usesParentCnpj: Boolean(row.uses_parent_cnpj),
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    postalCode: row.postal_code,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    responsibleName: row.responsible_name,
    foundationDate: row.foundation_date,
    notes: row.notes,
    status: row.status,
    conventionId: row.convention_id,
    conventionName: row.convention_name,
    matrixId: row.matrix_id,
    matrixName: row.matrix_name,
    parentName: row.parent_name,
    logoUrl: unitLogoUrl(row.id, row.logo_updated_at),
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    archivedByName: row.archived_by_name,
    archivedPreviousStatus: row.archived_previous_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function allUnits(
  includeArchived = false,
  tenantId?: number,
): Promise<UnitRecord[]> {
  const clauses = [
    includeArchived ? null : OPERATIONAL_UNIT_FILTER,
    tenantId ? "target.tenant_id = ?" : null,
  ].filter(Boolean);
  const rows = await database()
    .prepare(
      `${UNIT_SELECT} ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY target.name`,
    )
    .bind(...(tenantId ? [tenantId] : []))
    .all<UnitRow>();
  return rows.results.map(mapUnit);
}

export async function unitById(
  type: AdminUnitType,
  id: number,
  includeArchived = false,
  tenantId?: number,
): Promise<UnitRecord | null> {
  const row = await database()
    .prepare(
      `${UNIT_SELECT} WHERE target.type = ? AND target.id = ? ${tenantId ? "AND target.tenant_id = ?" : ""} ${includeArchived ? "" : `AND ${OPERATIONAL_UNIT_FILTER}`} LIMIT 1`,
    )
    .bind(type, id, ...(tenantId ? [tenantId] : []))
    .first<UnitRow>();
  return row ? mapUnit(row) : null;
}

export async function writeAudit(
  session: AdministrativeSession,
  metadata: RequestMetadata,
  action: string,
  entityType: string,
  entityId: number,
  unitId: number | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await database()
    .prepare(
      "INSERT INTO administration_audit (actor_user_id, actor_membership_id, tenant_id, convention_id, action, entity_type, entity_id, unit_id, ip_address, user_agent, device_summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      session.user.id,
      session.user.membershipId,
      session.user.tenantId,
      session.user.conventionId,
      action,
      entityType,
      entityId,
      unitId,
      metadata.ipAddress,
      metadata.userAgent,
      metadata.deviceSummary,
      JSON.stringify(details),
      nowIso(),
    )
    .run();
}

function unitOptionsFrom(session: AdministrativeSession, units: UnitRecord[]) {
  const convention = units.find(
    (unit) =>
      unit.type === "CONVENCAO" && unit.id === session.user.conventionId,
  );
  if (!convention)
    throw new ApiError(
      403,
      "VINCULO_INVALIDO",
      "A convenção vinculada não está disponível.",
    );
  const visible = units.filter(
    (unit) => canAdministerUnit(session.user, unit) && unit.status === "ATIVO",
  );
  return {
    convention: {
      id: convention.id,
      name: convention.name,
      status: convention.status,
      cnpj: convention.cnpj,
    },
    matrices: visible
      .filter((unit) => unit.type === "MATRIZ")
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        status: unit.status,
        cnpj: unit.cnpj,
      })),
    branches: visible
      .filter((unit) => unit.type === "FILIAL" && unit.matrixId !== null)
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        status: unit.status,
        matrixId: unit.matrixId!,
      })),
  };
}

export async function adminBootstrap(
  request: Request,
): Promise<AdminBootstrap> {
  const session = await administrativeSession(request);
  const [permissions, units, functions] = await Promise.all([
    permissionsFor(session.user.membershipId, session.user.id),
    allUnits(false, session.user.tenantId),
    database()
      .prepare(
        "SELECT id, name FROM organizational_functions WHERE tenant_id = ? AND status = 'ATIVO' ORDER BY name COLLATE NOCASE",
      )
      .bind(session.user.tenantId)
      .all<{ id: number; name: string }>(),
  ]);
  const allowedUserScopes: OrganizationalScope[] =
    session.user.scope === "CONVENCAO"
      ? ["CONVENCAO", "MATRIZ", "FILIAL"]
      : session.user.scope === "MATRIZ"
        ? ["MATRIZ", "FILIAL"]
        : ["FILIAL"];
  const creatableUnitTypes: AdminUnitType[] =
    session.user.scope === "CONVENCAO"
      ? ["MATRIZ", "FILIAL"]
      : session.user.scope === "MATRIZ"
        ? ["FILIAL"]
        : [];
  const canReceiveFunctionOptions = permissions.some(
    (permission) =>
      permission === "FUNCOES_VISUALIZAR" ||
      permission === "USUARIOS_CRIAR" ||
      permission === "USUARIOS_EDITAR",
  );
  return {
    isPlatformOwner: session.user.isPlatformOwner,
    permissions,
    permissionDefinitions: PERMISSION_DEFINITIONS.map((item) => ({ ...item })),
    unitOptions: unitOptionsFrom(session, units),
    allowedUserScopes,
    creatableUnitTypes,
    functionOptions: canReceiveFunctionOptions ? functions.results : [],
  };
}

export async function listAdminUnits(
  request: Request,
  query: {
    search?: unknown;
    type?: unknown;
    status?: unknown;
    page?: unknown;
    pageSize?: unknown;
  },
): Promise<PageResult<UnitRecord>> {
  const { session } = await requirePermission(request, "UNIDADES_VISUALIZAR");
  const search =
    typeof query.search === "string"
      ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120)
      : "";
  const type = ["CONVENCAO", "MATRIZ", "FILIAL"].includes(String(query.type))
    ? (query.type as AdminUnitType)
    : null;
  const status = ["ATIVO", "INATIVO"].includes(String(query.status))
    ? (query.status as AdminUnitStatus)
    : null;
  const items = (await allUnits(false, session.user.tenantId)).filter(
    (unit) => {
      if (!canAdministerUnit(session.user, unit)) return false;
      if (type && unit.type !== type) return false;
      if (status && unit.status !== status) return false;
      if (
        search &&
        !`${unit.name} ${unit.legalName ?? ""} ${unit.fantasyName ?? ""} ${unit.cnpj ?? ""} ${unit.city ?? ""} ${unit.responsibleName ?? ""} ${unit.parentName ?? ""} ${unit.conventionName}`
          .toLocaleLowerCase("pt-BR")
          .includes(search)
      )
        return false;
      return true;
    },
  );
  return paginate(items, query.page, query.pageSize);
}

export async function getAdminUnit(
  request: Request,
  type: AdminUnitType,
  id: number,
): Promise<UnitRecord> {
  const { session } = await requirePermission(request, "UNIDADES_VISUALIZAR");
  const unit = await unitById(type, id, false, session.user.tenantId);
  if (!unit || !canAdministerUnit(session.user, unit)) {
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  }
  return unit;
}

export async function unitByAnyId(
  id: number,
  includeArchived = false,
  tenantId?: number,
): Promise<UnitRecord | null> {
  const row = await database()
    .prepare(
      `${UNIT_SELECT} WHERE target.id = ? ${tenantId ? "AND target.tenant_id = ?" : ""} ${includeArchived ? "" : `AND ${OPERATIONAL_UNIT_FILTER}`} LIMIT 1`,
    )
    .bind(id, ...(tenantId ? [tenantId] : []))
    .first<UnitRow>();
  return row ? mapUnit(row) : null;
}

export async function authorizeUnitLogoRead(
  request: Request,
  id: number,
): Promise<void> {
  const session = await administrativeSession(request);
  const unit = await unitByAnyId(id, false, session.user.tenantId);
  if (!unit || !canReadUnitLogo(session.user, session.activeContext, unit)) {
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  }
}

export async function updateAdminUnitLogo(
  request: Request,
  type: AdminUnitType,
  id: number,
  upload: ValidatedImageUpload | null | (() => Promise<ValidatedImageUpload>),
): Promise<string | null> {
  assertTrustedOrigin(request);
  const { session, metadata } = await requirePermission(
    request,
    "UNIDADES_EDITAR",
  );
  const unit = await unitById(type, id, false, session.user.tenantId);
  if (!unit || !canAdministerUnit(session.user, unit)) {
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  }
  const resolvedUpload = typeof upload === "function" ? await upload() : upload;
  const updatedAt = resolvedUpload
    ? await saveUnitLogo(unit.id, resolvedUpload)
    : (await removeUnitLogo(unit.id), null);
  await writeAudit(
    session,
    metadata,
    resolvedUpload ? "LOGO_UNIDADE_ATUALIZADA" : "LOGO_UNIDADE_REMOVIDA",
    "UNIDADE",
    unit.id,
    unit.id,
  );
  return unitLogoUrl(unit.id, updatedAt);
}

export function assertUniqueUnit(
  units: UnitRecord[],
  name: string,
  type: AdminUnitType,
  parentId: number | null,
  excludedId?: number,
): void {
  const duplicate = units.some((unit) => {
    const unitParent =
      unit.type === "FILIAL"
        ? unit.matrixId
        : unit.type === "MATRIZ"
          ? unit.conventionId
          : null;
    return (
      unit.id !== excludedId &&
      unit.type === type &&
      unitParent === parentId &&
      unit.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
    );
  });
  if (duplicate)
    throw new ApiError(
      409,
      "REGISTRO_DUPLICADO",
      "Já existe uma unidade com este nome nesse vínculo.",
    );
}

export async function createAdminUnit(
  request: Request,
  input: UnitWriteInput,
): Promise<UnitRecord> {
  const { session, metadata } = await requirePermission(
    request,
    "UNIDADES_CRIAR",
  );
  const type = input.type;
  if (!type || !["MATRIZ", "FILIAL"].includes(type)) {
    throw new ApiError(
      403,
      "ESCOPO_CONVENCAO_LIMITADO",
      "Sua conta pode administrar apenas a própria convenção.",
    );
  }
  const values = normalizeUnitInput(input);
  let parentId: number;
  let parentMatrix: UnitRecord | null = null;
  if (type === "MATRIZ") {
    if (session.user.scope !== "CONVENCAO")
      throw new ApiError(
        403,
        "ESCOPO_NEGADO",
        "Somente a Convenção pode cadastrar uma matriz.",
      );
    parentId = session.user.conventionId;
  } else {
    const matrixId = Number(input.matrixId);
    parentMatrix = Number.isInteger(matrixId)
      ? await unitById("MATRIZ", matrixId, false, session.user.tenantId)
      : null;
    if (
      !parentMatrix ||
      parentMatrix.status !== "ATIVO" ||
      !canAdministerUnit(session.user, parentMatrix) ||
      session.user.scope === "FILIAL"
    ) {
      throw new ApiError(
        400,
        "MATRIZ_INVALIDA",
        "A matriz selecionada não está disponível.",
      );
    }
    parentId = parentMatrix.id;
  }
  const usesParentCnpj = type === "FILIAL" && input.usesParentCnpj === true;
  if (usesParentCnpj && !canInheritCnpj(type, parentMatrix?.ownCnpj ?? null))
    throw new ApiError(
      400,
      "MATRIZ_SEM_CNPJ",
      "Cadastre o CNPJ da Matriz antes de usá-lo nesta Filial.",
    );
  const ownCnpj = usesParentCnpj ? null : values.cnpj;
  assertUniqueUnit(
    await allUnits(true, session.user.tenantId),
    values.name,
    type,
    parentId,
  );
  await assertUniqueCnpj(ownCnpj, session.user.tenantId);
  const id = generatedId();
  const timestamp = nowIso();
  const code = `${type}-${values.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 80)}-${String(id).slice(-6)}`;
  await database()
    .prepare(
      "INSERT INTO organizational_units (id, tenant_id, type, name, fantasy_name, legal_name, cnpj, uses_parent_cnpj, phone, whatsapp, email, postal_code, street, number, complement, district, city, state, responsible_name, foundation_date, notes, code, parent_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', ?, ?)",
    )
    .bind(
      id,
      session.user.tenantId,
      type,
      values.name,
      values.fantasyName,
      values.legalName,
      ownCnpj,
      usesParentCnpj ? 1 : 0,
      values.phone,
      values.whatsapp,
      values.email,
      values.postalCode,
      values.street,
      values.number,
      values.complement,
      values.district,
      values.city,
      values.state,
      values.responsibleName,
      values.foundationDate,
      values.notes,
      code,
      parentId,
      timestamp,
      timestamp,
    )
    .run();
  const unit = await unitById(type, id, false, session.user.tenantId);
  if (!unit)
    throw new ApiError(
      500,
      "ERRO_INTERNO",
      "Não foi possível recuperar a unidade cadastrada.",
    );
  await writeAudit(session, metadata, "UNIDADE_CRIADA", "UNIDADE", id, id, {
    type,
    name: values.name,
  });
  return unit;
}

export async function updateAdminUnit(
  request: Request,
  type: AdminUnitType,
  id: number,
  input: UnitWriteInput,
): Promise<UnitRecord> {
  const { session, metadata } = await requirePermission(
    request,
    "UNIDADES_EDITAR",
  );
  const unit = await unitById(type, id, false, session.user.tenantId);
  if (!unit || !canAdministerUnit(session.user, unit))
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  const values = normalizeUnitInput(input);
  let parentId =
    unit.type === "CONVENCAO"
      ? null
      : unit.type === "MATRIZ"
        ? unit.conventionId
        : unit.matrixId;
  if (
    unit.type === "FILIAL" &&
    input.matrixId &&
    input.matrixId !== unit.matrixId
  ) {
    const matrix = await unitById(
      "MATRIZ",
      Number(input.matrixId),
      false,
      session.user.tenantId,
    );
    if (
      !matrix ||
      matrix.status !== "ATIVO" ||
      !canAdministerUnit(session.user, matrix)
    ) {
      throw new ApiError(
        400,
        "MATRIZ_INVALIDA",
        "A nova matriz não está disponível.",
      );
    }
    parentId = matrix.id;
  }
  const parentMatrix =
    unit.type === "FILIAL" && parentId
      ? await unitById("MATRIZ", parentId, false, session.user.tenantId)
      : null;
  const usesParentCnpj =
    unit.type === "FILIAL" && input.usesParentCnpj === true;
  if (
    usesParentCnpj &&
    !canInheritCnpj(unit.type, parentMatrix?.ownCnpj ?? null)
  )
    throw new ApiError(
      400,
      "MATRIZ_SEM_CNPJ",
      "Cadastre o CNPJ da Matriz antes de usá-lo nesta Filial.",
    );
  const ownCnpj = usesParentCnpj ? null : values.cnpj;
  if (unit.type === "MATRIZ" && !ownCnpj) {
    const inheritedChild = await database()
      .prepare(
        "SELECT id FROM organizational_units WHERE tenant_id = ? AND parent_id = ? AND type = 'FILIAL' AND uses_parent_cnpj = 1 LIMIT 1",
      )
      .bind(session.user.tenantId, unit.id)
      .first<{ id: number }>();
    if (inheritedChild)
      throw new ApiError(
        409,
        "CNPJ_EM_USO",
        "Esta Matriz possui Filial usando seu CNPJ. Defina outro CNPJ antes de removê-lo.",
      );
  }
  assertUniqueUnit(
    await allUnits(true, session.user.tenantId),
    values.name,
    unit.type,
    parentId,
    unit.id,
  );
  await assertUniqueCnpj(ownCnpj, session.user.tenantId, unit.id);
  await database()
    .prepare(
      "UPDATE organizational_units SET name = ?, fantasy_name = ?, legal_name = ?, cnpj = ?, uses_parent_cnpj = ?, phone = ?, whatsapp = ?, email = ?, postal_code = ?, street = ?, number = ?, complement = ?, district = ?, city = ?, state = ?, responsible_name = ?, foundation_date = ?, notes = ?, parent_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
    )
    .bind(
      values.name,
      values.fantasyName,
      values.legalName,
      ownCnpj,
      usesParentCnpj ? 1 : 0,
      values.phone,
      values.whatsapp,
      values.email,
      values.postalCode,
      values.street,
      values.number,
      values.complement,
      values.district,
      values.city,
      values.state,
      values.responsibleName,
      values.foundationDate,
      values.notes,
      parentId,
      nowIso(),
      unit.id,
      session.user.tenantId,
    )
    .run();
  await writeAudit(
    session,
    metadata,
    "UNIDADE_EDITADA",
    "UNIDADE",
    unit.id,
    unit.id,
    { name: values.name, parentId },
  );
  return (await unitById(type, id, false, session.user.tenantId))!;
}

export async function setAdminUnitStatus(
  request: Request,
  type: AdminUnitType,
  id: number,
  status: AdminUnitStatus,
): Promise<UnitRecord> {
  const { session, metadata } = await requirePermission(
    request,
    "UNIDADES_EDITAR",
  );
  const unit = await unitById(type, id, false, session.user.tenantId);
  if (!unit || !canAdministerUnit(session.user, unit))
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  if (status !== "ATIVO" && status !== "INATIVO")
    throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
  if (status === "INATIVO") {
    const isOwn =
      unit.id === session.user.conventionId ||
      unit.id === session.user.boundMatrixId ||
      unit.id === session.user.boundBranchId ||
      unit.id === session.activeContext?.matrixId ||
      unit.id === session.activeContext?.branchId;
    if (isOwn)
      throw new ApiError(
        409,
        "UNIDADE_EM_USO",
        "Não é possível desativar a unidade usada pela sua própria sessão.",
      );
  } else if (unit.type !== "CONVENCAO") {
    const parent =
      unit.type === "MATRIZ"
        ? await unitById(
            "CONVENCAO",
            unit.conventionId,
            false,
            session.user.tenantId,
          )
        : unit.matrixId
          ? await unitById(
              "MATRIZ",
              unit.matrixId,
              false,
              session.user.tenantId,
            )
          : null;
    if (!parent || parent.status !== "ATIVO")
      throw new ApiError(
        409,
        "UNIDADE_PAI_INATIVA",
        "Ative a unidade superior antes de continuar.",
      );
  }
  await database()
    .prepare(
      "UPDATE organizational_units SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
    )
    .bind(status, nowIso(), unit.id, session.user.tenantId)
    .run();
  await writeAudit(
    session,
    metadata,
    status === "ATIVO" ? "UNIDADE_ATIVADA" : "UNIDADE_DESATIVADA",
    "UNIDADE",
    unit.id,
    unit.id,
  );
  return (await unitById(type, id, false, session.user.tenantId))!;
}

function conventionIdForUser(row: UserRow): number {
  if (row.scope_unit_type === "CONVENCAO") return row.scope_unit_id;
  if (row.scope_unit_type === "MATRIZ") return row.parent_id ?? 0;
  return row.grandparent_id ?? 0;
}

function canAdministerUser(
  session: AdministrativeSession,
  row: UserRow,
): boolean {
  return canAdministerUserTarget(session.user, {
    tenantId: row.tenant_id,
    conventionId: conventionIdForUser(row),
    scope: row.scope,
    boundMatrixId: row.scope === "MATRIZ" ? row.scope_unit_id : null,
    boundBranchId: row.scope === "FILIAL" ? row.scope_unit_id : null,
    branchMatrixId: row.scope === "FILIAL" ? row.parent_id : null,
  });
}

function isUserUnitVisible(row: UserRow): boolean {
  if (row.scope_unit_archived_at) return false;
  if (row.scope_unit_type === "MATRIZ") return !row.parent_archived_at;
  if (row.scope_unit_type === "FILIAL")
    return !row.parent_archived_at && !row.grandparent_archived_at;
  return true;
}

async function allUserRows(tenantId?: number): Promise<UserRow[]> {
  const result = await database()
    .prepare(
      `${USER_SELECT} ${tenantId ? "WHERE membership.tenant_id = ?" : ""} ORDER BY membership.display_name`,
    )
    .bind(nowIso(), ...(tenantId ? [tenantId] : []))
    .all<UserRow>();
  return result.results;
}

async function userRowById(
  id: number,
  tenantId?: number,
): Promise<UserRow | null> {
  return database()
    .prepare(
      `${USER_SELECT} WHERE membership.id = ? ${tenantId ? "AND membership.tenant_id = ?" : ""} LIMIT 1`,
    )
    .bind(nowIso(), id, ...(tenantId ? [tenantId] : []))
    .first<UserRow>();
}

async function mapUser(row: UserRow): Promise<UserRecord> {
  const blocked = Boolean(
    row.blocked_until && new Date(row.blocked_until).getTime() > Date.now(),
  );
  return {
    id: row.id,
    identityId: row.identity_id,
    tenantId: row.tenant_id,
    conventionId: conventionIdForUser(row),
    name: row.name,
    username: row.username,
    email: row.email,
    cpf: row.cpf,
    cpfHint: `***.***.***-${row.cpf.slice(-2)}`,
    roleName: row.role_name,
    functionId: row.function_id,
    scope: row.scope,
    status: blocked ? "BLOQUEADO" : row.status,
    mustChangePassword: Boolean(row.must_change_password),
    boundMatrixId: row.scope === "MATRIZ" ? row.scope_unit_id : null,
    boundBranchId: row.scope === "FILIAL" ? row.scope_unit_id : null,
    branchMatrixId: row.scope === "FILIAL" ? row.parent_id : null,
    matrixName:
      row.scope === "MATRIZ"
        ? row.scope_unit_name
        : row.scope === "FILIAL"
          ? row.parent_name
          : null,
    branchName: row.scope === "FILIAL" ? row.scope_unit_name : null,
    permissions: await permissionsFor(row.id),
    activeSessions: Number(row.active_sessions),
    lastLoginAt: row.last_login_at,
    profilePhotoUrl: userPhotoUrl(
      row.identity_id,
      row.profile_photo_updated_at,
    ),
    archivedAt: row.archived_at,
    archivedBy: row.archived_by,
    archivedByName: row.archived_by_name,
    archivedPreviousStatus: row.archived_previous_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminUsers(
  request: Request,
  query: {
    search?: unknown;
    scope?: unknown;
    status?: unknown;
    page?: unknown;
    pageSize?: unknown;
  },
): Promise<PageResult<UserRecord>> {
  const { session } = await requirePermission(request, "USUARIOS_VISUALIZAR");
  const search =
    typeof query.search === "string"
      ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120)
      : "";
  const scope = ["CONVENCAO", "MATRIZ", "FILIAL"].includes(String(query.scope))
    ? (query.scope as OrganizationalScope)
    : null;
  const status = ["ATIVO", "INATIVO", "PENDENTE", "BLOQUEADO"].includes(
    String(query.status),
  )
    ? String(query.status)
    : null;
  const visibleRows = (await allUserRows(session.user.tenantId)).filter(
    (row) =>
      !row.archived_at &&
      !row.is_platform_owner &&
      isUserUnitVisible(row) &&
      canAdministerUser(session, row),
  );
  const records = await Promise.all(visibleRows.map(mapUser));
  const filtered = records.filter((user) => {
    if (scope && user.scope !== scope) return false;
    if (status && user.status !== status) return false;
    if (
      search &&
      !`${user.name} ${user.username} ${user.email} ${user.roleName}`
        .toLocaleLowerCase("pt-BR")
        .includes(search)
    )
      return false;
    return true;
  });
  return paginate(filtered, query.page, query.pageSize);
}

export async function getAdminUser(
  request: Request,
  id: number,
): Promise<UserRecord> {
  const { session } = await requirePermission(request, "USUARIOS_VISUALIZAR");
  return (await targetUser(session, id)).record;
}

async function targetUser(
  session: AdministrativeSession,
  id: number,
): Promise<{ row: UserRow; record: UserRecord }> {
  const row = await userRowById(id, session.user.tenantId);
  if (
    !row ||
    row.archived_at ||
    row.is_platform_owner ||
    !isUserUnitVisible(row) ||
    !canAdministerUser(session, row)
  )
    throw new ApiError(
      404,
      "USUARIO_NAO_ENCONTRADO",
      "Usuário não encontrado.",
    );
  return { row, record: await mapUser(row) };
}

export async function authorizeUserPhotoRead(
  request: Request,
  id: number,
): Promise<void> {
  const session = await administrativeSession(request);
  if (session.user.id === id) return;
  const rows = (await allUserRows(session.user.tenantId)).filter(
    (row) => row.identity_id === id,
  );
  if (
    !rows.some(
      (row) =>
        !row.archived_at &&
        isUserUnitVisible(row) &&
        canAdministerUser(session, row),
    )
  ) {
    throw new ApiError(
      404,
      "USUARIO_NAO_ENCONTRADO",
      "Usuário não encontrado.",
    );
  }
}

export async function updateAdminUserPhoto(
  request: Request,
  id: number,
  upload: ValidatedImageUpload | null | (() => Promise<ValidatedImageUpload>),
): Promise<string | null> {
  assertTrustedOrigin(request);
  const { session, metadata } = await requirePermission(
    request,
    "USUARIOS_EDITAR",
  );
  const target = await targetUser(session, id);
  const resolvedUpload = typeof upload === "function" ? await upload() : upload;
  const updatedAt = resolvedUpload
    ? await saveUserPhoto(target.row.identity_id, resolvedUpload)
    : (await removeUserPhoto(target.row.identity_id), null);
  await writeAudit(
    session,
    metadata,
    resolvedUpload ? "FOTO_USUARIO_ATUALIZADA" : "FOTO_USUARIO_REMOVIDA",
    "USUARIO",
    target.row.id,
    target.row.scope_unit_id,
  );
  return userPhotoUrl(target.row.identity_id, updatedAt);
}

function validateDelegation(
  actorPermissions: Set<PermissionCode>,
  permissions: unknown,
): PermissionCode[] {
  if (
    !Array.isArray(permissions) ||
    permissions.some((item) => !isPermissionCode(item))
  ) {
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      "Revise as permissões do usuário.",
    );
  }
  const unique = Array.from(new Set(permissions));
  if (unique.length !== permissions.length)
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      "Há permissões repetidas no cadastro.",
    );
  if (unique.some((permission) => !actorPermissions.has(permission))) {
    throw new ApiError(
      403,
      "PERMISSAO_NAO_DELEGAVEL",
      "Você não pode conceder uma permissão que não possui.",
    );
  }
  return unique;
}

function permissionsWithScopeDefaults(
  actorPermissions: Set<PermissionCode>,
  delegated: PermissionCode[],
  scope: OrganizationalScope,
): PermissionCode[] {
  const next = new Set(delegated);
  const completeFinanceAdministration =
    next.has("FINANCEIRO_CAIXA_ABRIR") &&
    next.has("FINANCEIRO_CAIXA_FECHAR") &&
    next.has("FINANCEIRO_CONFIGURAR");
  const defaults: PermissionCode[] = [];
  if (scope === "MATRIZ" && completeFinanceAdministration) {
    defaults.push(
      "FINANCEIRO_CAIXA_REABRIR",
      "FINANCEIRO_CAIXA_REABERTURA_APROVAR",
      "FINANCEIRO_RATEIO_PERIODO_ALTERAR",
    );
  }
  if (scope === "FILIAL" && next.has("FINANCEIRO_VISUALIZAR")) {
    defaults.push("FINANCEIRO_CAIXA_REABERTURA_SOLICITAR");
  }
  for (const permission of defaults) {
    if (actorPermissions.has(permission)) next.add(permission);
  }
  return Array.from(next);
}

async function bindingForUser(
  session: AdministrativeSession,
  scope: OrganizationalScope,
  matrixId?: number | null,
  branchId?: number | null,
): Promise<number> {
  if (scope === "CONVENCAO") {
    if (session.user.scope !== "CONVENCAO")
      throw new ApiError(
        403,
        "ESCOPO_NEGADO",
        "Você não pode criar um acesso de Convenção.",
      );
    return session.user.conventionId;
  }
  if (scope === "MATRIZ") {
    const unit = matrixId
      ? await unitById("MATRIZ", matrixId, false, session.user.tenantId)
      : null;
    if (
      !unit ||
      unit.status !== "ATIVO" ||
      !canAdministerUnit(session.user, unit)
    )
      throw new ApiError(
        400,
        "MATRIZ_INVALIDA",
        "A matriz selecionada não está disponível.",
      );
    return unit.id;
  }
  const unit = branchId
    ? await unitById("FILIAL", branchId, false, session.user.tenantId)
    : null;
  if (
    !unit ||
    unit.status !== "ATIVO" ||
    !canAdministerUnit(session.user, unit)
  )
    throw new ApiError(
      400,
      "FILIAL_INVALIDA",
      "A filial selecionada não está disponível.",
    );
  return unit.id;
}

async function normalizedUserInput(
  input: UserWriteInput,
  tenantId: number,
): Promise<{
  name: string;
  username: string;
  email: string;
  roleName: string;
  functionId: number;
  scope: OrganizationalScope;
}> {
  const name = cleanText(input.name, "O nome", 150);
  const functionId = Number(input.functionId);
  if (!Number.isInteger(functionId) || functionId <= 0)
    throw new ApiError(400, "FUNCAO_INVALIDA", "Selecione uma função válida.");
  const organizationalFunction = await database()
    .prepare(
      "SELECT name FROM organizational_functions WHERE id = ? AND tenant_id = ? AND status = 'ATIVO' LIMIT 1",
    )
    .bind(functionId, tenantId)
    .first<{ name: string }>();
  if (!organizationalFunction)
    throw new ApiError(
      400,
      "FUNCAO_INVALIDA",
      "A função selecionada não está ativa nesta organização.",
    );
  const username = normalizeLoginIdentifier(String(input.username ?? ""));
  const email = normalizeLoginIdentifier(String(input.email ?? ""));
  if (!username.valid || username.type !== "USUARIO")
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      "Informe um nome de usuário válido.",
    );
  if (!email.valid || email.type !== "EMAIL")
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe um e-mail válido.");
  if (!["CONVENCAO", "MATRIZ", "FILIAL"].includes(input.scope))
    throw new ApiError(400, "DADOS_INVALIDOS", "Escopo inválido.");
  return {
    name,
    username: username.normalized,
    email: email.normalized,
    roleName: organizationalFunction.name,
    functionId,
    scope: input.scope,
  };
}

function normalizedCpf(value: string): string {
  const identifier = normalizeLoginIdentifier(value);
  if (!identifier.valid || identifier.type !== "CPF")
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe um CPF válido.");
  return identifier.normalized;
}

function validatePassword(password: string): void {
  if (!isPasswordValid(password)) {
    throw new ApiError(400, "SENHA_TEMPORARIA_CURTA", PASSWORD_POLICY_MESSAGE);
  }
}

async function assertTenantIdentifiersAvailable(
  tenantId: number,
  values: { username: string; email: string; cpf: string },
  excludedIdentityId?: number,
): Promise<void> {
  const params = [
    tenantId,
    ...(excludedIdentityId ? [excludedIdentityId] : []),
  ];
  const exclusion = excludedIdentityId ? "AND id <> ?" : "";
  const [username, email, cpf, platformOwner] = await Promise.all([
    database()
      .prepare(
        `SELECT id FROM auth_users WHERE tenant_id = ? ${exclusion} AND username = ? COLLATE NOCASE LIMIT 1`,
      )
      .bind(...params, values.username)
      .first(),
    database()
      .prepare(
        `SELECT id FROM auth_users WHERE tenant_id = ? ${exclusion} AND email = ? COLLATE NOCASE LIMIT 1`,
      )
      .bind(...params, values.email)
      .first(),
    database()
      .prepare(
        `SELECT id FROM auth_users WHERE tenant_id = ? ${exclusion} AND cpf = ? LIMIT 1`,
      )
      .bind(...params, values.cpf)
      .first(),
    database()
      .prepare(
        "SELECT u.id FROM auth_users u JOIN platform_owners owner ON owner.user_id = u.id WHERE u.username = ? COLLATE NOCASE OR u.email = ? COLLATE NOCASE OR u.cpf = ? LIMIT 1",
      )
      .bind(values.username, values.email, values.cpf)
      .first(),
  ]);
  if (platformOwner)
    throw new ApiError(
      409,
      "IDENTIFICADOR_RESERVADO",
      "Um dos identificadores informados é reservado pela administração da plataforma.",
    );
  if (username)
    throw new ApiError(
      409,
      "USUARIO_JA_CADASTRADO",
      "Este nome de usuário já está cadastrado nesta organização.",
    );
  if (email)
    throw new ApiError(
      409,
      "EMAIL_JA_CADASTRADO",
      "Este e-mail já está cadastrado nesta organização.",
    );
  if (cpf)
    throw new ApiError(
      409,
      "CPF_JA_CADASTRADO",
      "Este CPF já está cadastrado nesta organização.",
    );
}

export async function createAdminUser(
  request: Request,
  input: UserWriteInput,
): Promise<UserRecord> {
  const { session, permissions, metadata } = await requirePermission(
    request,
    "USUARIOS_CRIAR",
  );
  const values = await normalizedUserInput(input, session.user.tenantId);
  const delegated = permissionsWithScopeDefaults(
    permissions,
    validateDelegation(permissions, input.permissions),
    values.scope,
  );
  const unitId = await bindingForUser(
    session,
    values.scope,
    input.matrixId,
    input.branchId,
  );
  const cpf = normalizedCpf(String(input.cpf ?? ""));
  const password = String(input.temporaryPassword ?? "");
  validatePassword(password);
  await assertTenantIdentifiersAvailable(session.user.tenantId, {
    username: values.username,
    email: values.email,
    cpf,
  });
  const identityId = generatedId();
  const membershipId = generatedId();
  const timestamp = nowIso();
  const passwordHash = await bcrypt.hash(password, 12);
  const statements = [
    database()
      .prepare(
        "INSERT INTO auth_users (id, tenant_id, name, username, email, cpf, password_hash, role_name, scope, status, must_change_password, failed_attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', 1, 0, ?, ?)",
      )
      .bind(
        identityId,
        session.user.tenantId,
        values.name,
        values.username,
        values.email,
        cpf,
        passwordHash,
        values.roleName,
        values.scope,
        timestamp,
        timestamp,
      ),
    database()
      .prepare(
        "INSERT INTO user_unit_links (user_id, unit_id, is_primary, created_at) VALUES (?, ?, 1, ?)",
      )
      .bind(identityId, unitId, timestamp),
  ];
  statements.push(
    database()
      .prepare(
        "INSERT INTO tenant_memberships (id, user_id, tenant_id, display_name, role_name, function_id, scope, scope_unit_id, status, invited_by_membership_id, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        membershipId,
        identityId,
        session.user.tenantId,
        values.name,
        values.roleName,
        values.functionId,
        values.scope,
        unitId,
        "ATIVO",
        session.user.membershipId,
        timestamp,
        timestamp,
        timestamp,
      ),
    ...delegated.map((permission) =>
      database()
        .prepare(
          "INSERT INTO membership_permissions (membership_id, permission, created_at) VALUES (?, ?, ?)",
        )
        .bind(membershipId, permission, timestamp),
    ),
  );
  await database().batch(statements);
  await writeAudit(
    session,
    metadata,
    "USUARIO_TENANT_CRIADO",
    "MEMBERSHIP",
    membershipId,
    unitId,
    { scope: values.scope, credentialOwnerTenantId: session.user.tenantId },
  );
  return await mapUser(
    (await userRowById(membershipId, session.user.tenantId))!,
  );
}

export async function updateAdminUser(
  request: Request,
  id: number,
  input: UserWriteInput,
): Promise<UserRecord> {
  const { session, permissions, metadata } = await requirePermission(
    request,
    "USUARIOS_EDITAR",
  );
  const target = await targetUser(session, id);
  if (target.row.id === session.user.membershipId)
    throw new ApiError(
      409,
      "AUTOEDICAO_BLOQUEADA",
      "Use as configurações da conta para alterar seu próprio cadastro.",
    );
  const values = await normalizedUserInput(input, session.user.tenantId);
  const cpf = normalizedCpf(String(input.cpf ?? target.row.cpf));
  await assertTenantIdentifiersAvailable(
    session.user.tenantId,
    { username: values.username, email: values.email, cpf },
    target.row.identity_id,
  );
  const delegated = permissionsWithScopeDefaults(
    permissions,
    validateDelegation(permissions, input.permissions),
    values.scope,
  );
  const unitId = await bindingForUser(
    session,
    values.scope,
    input.matrixId,
    input.branchId,
  );
  const timestamp = nowIso();
  const statements = [
    database()
      .prepare(
        "UPDATE auth_users SET name = ?, username = ?, email = ?, cpf = ?, role_name = ?, scope = ?, tenant_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
      )
      .bind(
        values.name,
        values.username,
        values.email,
        cpf,
        values.roleName,
        values.scope,
        session.user.tenantId,
        timestamp,
        target.row.identity_id,
        session.user.tenantId,
      ),
    database()
      .prepare(
        "UPDATE tenant_memberships SET display_name = ?, role_name = ?, function_id = ?, scope = ?, scope_unit_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
      )
      .bind(
        values.name,
        values.roleName,
        values.functionId,
        values.scope,
        unitId,
        timestamp,
        target.row.id,
        session.user.tenantId,
      ),
    database()
      .prepare(
        "UPDATE user_unit_links SET unit_id = ? WHERE user_id = ? AND is_primary = 1",
      )
      .bind(unitId, target.row.identity_id),
    database()
      .prepare("DELETE FROM membership_permissions WHERE membership_id = ?")
      .bind(target.row.id),
    ...delegated.map((permission) =>
      database()
        .prepare(
          "INSERT INTO membership_permissions (membership_id, permission, created_at) VALUES (?, ?, ?)",
        )
        .bind(target.row.id, permission, timestamp),
    ),
    database()
      .prepare("DELETE FROM auth_sessions WHERE membership_id = ?")
      .bind(target.row.id),
  ];
  await database().batch(statements);
  await writeAudit(
    session,
    metadata,
    "USUARIO_TENANT_EDITADO",
    "USUARIO",
    target.row.id,
    unitId,
    { scope: values.scope },
  );
  return mapUser((await userRowById(target.row.id, session.user.tenantId))!);
}

export async function setAdminUserStatus(
  request: Request,
  id: number,
  status: "ATIVO" | "INATIVO",
): Promise<UserRecord> {
  const { session, metadata } = await requirePermission(
    request,
    "USUARIOS_DESATIVAR",
  );
  const target = await targetUser(session, id);
  if (target.row.id === session.user.membershipId)
    throw new ApiError(
      409,
      "AUTOALTERACAO_BLOQUEADA",
      "Você não pode desativar seu próprio vínculo.",
    );
  if (status !== "ATIVO" && status !== "INATIVO")
    throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido.");
  if (target.row.status === "PENDENTE") {
    throw new ApiError(
      409,
      "CONVITE_PENDENTE",
      "Somente o titular pode aceitar e ativar este convite após autenticar.",
    );
  }
  if (status === "ATIVO") {
    const binding = await unitById(
      target.row.scope_unit_type,
      target.row.scope_unit_id,
      false,
      session.user.tenantId,
    );
    if (
      !binding ||
      binding.status !== "ATIVO" ||
      !canAdministerUnit(session.user, binding)
    )
      throw new ApiError(
        409,
        "VINCULO_INATIVO",
        "Ative a unidade vinculada antes do usuário.",
      );
  }
  const statements = [
    database()
      .prepare(
        "UPDATE tenant_memberships SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
      )
      .bind(status, nowIso(), target.row.id, session.user.tenantId),
  ];
  if (status === "INATIVO")
    statements.push(
      database()
        .prepare("DELETE FROM auth_sessions WHERE membership_id = ?")
        .bind(target.row.id),
    );
  await database().batch(statements);
  await writeAudit(
    session,
    metadata,
    status === "ATIVO" ? "USUARIO_ATIVADO" : "USUARIO_DESATIVADO",
    "USUARIO",
    target.row.id,
    target.row.scope_unit_id,
  );
  return mapUser((await userRowById(target.row.id, session.user.tenantId))!);
}

export async function resetAdminUserPassword(
  request: Request,
  id: number,
): Promise<void> {
  const { session, metadata } = await requirePermission(
    request,
    "USUARIOS_REDEFINIR_SENHA",
  );
  const target = await targetUser(session, id);
  if (target.row.id === session.user.membershipId)
    throw new ApiError(
      409,
      "AUTOALTERACAO_BLOQUEADA",
      "Use a opção Trocar minha senha para sua própria conta.",
    );
  await database()
    .prepare("DELETE FROM auth_sessions WHERE membership_id = ?")
    .bind(target.row.id)
    .run();
  await writeAudit(
    session,
    metadata,
    "RECUPERACAO_CREDENCIAL_ORIENTADA",
    "MEMBERSHIP",
    target.row.id,
    target.row.scope_unit_id,
    { tenantCredentialChanged: false },
  );
}

export async function revokeAdminUserSessions(
  request: Request,
  id: number,
): Promise<number> {
  const { session, metadata } = await requirePermission(
    request,
    "USUARIOS_REDEFINIR_SENHA",
  );
  const target = await targetUser(session, id);
  if (target.row.id === session.user.membershipId)
    throw new ApiError(
      409,
      "AUTOALTERACAO_BLOQUEADA",
      "Use o botão Sair para encerrar sua própria sessão.",
    );
  const count = await database()
    .prepare(
      "SELECT COUNT(*) AS total FROM auth_sessions WHERE membership_id = ?",
    )
    .bind(target.row.id)
    .first<{ total: number }>();
  await database()
    .prepare("DELETE FROM auth_sessions WHERE membership_id = ?")
    .bind(target.row.id)
    .run();
  await writeAudit(
    session,
    metadata,
    "SESSAO_REVOGADA",
    "USUARIO",
    target.row.id,
    target.row.scope_unit_id,
    { total: Number(count?.total ?? 0) },
  );
  return Number(count?.total ?? 0);
}

export async function listAccessHistory(
  request: Request,
  query: {
    search?: unknown;
    result?: unknown;
    identifierType?: unknown;
    dateFrom?: unknown;
    dateTo?: unknown;
    page?: unknown;
    pageSize?: unknown;
  },
): Promise<PageResult<AccessHistoryRecord>> {
  const { session } = await requirePermission(request, "ACESSOS_VISUALIZAR");
  const rows = (await allUserRows(session.user.tenantId)).filter((row) =>
    canAdministerUser(session, row),
  );
  if (!rows.length) return paginate([], query.page, query.pageSize);
  const userMapByMembership = new Map(rows.map((row) => [row.id, row]));
  const userMapByIdentity = new Map(rows.map((row) => [row.identity_id, row]));
  const identityIds = Array.from(userMapByIdentity.keys());
  const membershipIds = Array.from(userMapByMembership.keys());
  const identityPlaceholders = identityIds.map(() => "?").join(",");
  const membershipPlaceholders = membershipIds.map(() => "?").join(",");
  const [loginRows, securityRows, adminRows] = await Promise.all([
    database()
      .prepare(
        `SELECT id, user_id, identifier_type, success, failure_reason, ip_address, device_summary, created_at FROM login_history WHERE tenant_id = ? AND user_id IN (${identityPlaceholders}) ORDER BY created_at DESC LIMIT 500`,
      )
      .bind(session.user.tenantId, ...identityIds)
      .all<{
        id: number;
        user_id: number;
        identifier_type: "CPF" | "USUARIO" | "EMAIL";
        success: number;
        failure_reason: string | null;
        ip_address: string | null;
        device_summary: string | null;
        created_at: string;
      }>(),
    database()
      .prepare(
        `SELECT id, user_id, event, identifier_type, reason, matrix_id, branch_id, created_at FROM audit_logs WHERE tenant_id = ? AND user_id IN (${identityPlaceholders}) ORDER BY created_at DESC LIMIT 500`,
      )
      .bind(session.user.tenantId, ...identityIds)
      .all<{
        id: number;
        user_id: number;
        event: string;
        identifier_type: "CPF" | "USUARIO" | "EMAIL" | null;
        reason: string;
        matrix_id: number | null;
        branch_id: number | null;
        created_at: string;
      }>(),
    database()
      .prepare(
        `SELECT id, actor_user_id, actor_membership_id, action, unit_id, ip_address, device_summary, created_at FROM administration_audit WHERE tenant_id = ? AND (actor_membership_id IN (${membershipPlaceholders}) OR (actor_membership_id IS NULL AND actor_user_id IN (${identityPlaceholders}))) ORDER BY created_at DESC LIMIT 500`,
      )
      .bind(session.user.tenantId, ...membershipIds, ...identityIds)
      .all<{
        id: number;
        actor_user_id: number;
        actor_membership_id: number | null;
        action: string;
        unit_id: number | null;
        ip_address: string | null;
        device_summary: string | null;
        created_at: string;
      }>(),
  ]);
  const unitNames = new Map(
    (await allUnits(false, session.user.tenantId)).map((unit) => [
      unit.id,
      unit.name,
    ]),
  );
  const items: AccessHistoryRecord[] = [];
  for (const entry of loginRows.results) {
    const user = userMapByIdentity.get(entry.user_id)!;
    const limited =
      entry.failure_reason === "LIMITE_DE_TENTATIVAS" ||
      entry.failure_reason === "BLOQUEIO_ATIVO";
    items.push({
      id: entry.id,
      userId: user.id,
      userName: user.name,
      username: user.username,
      event: entry.success
        ? "LOGIN_SUCESSO"
        : limited
          ? "BLOQUEIO_TEMPORARIO"
          : "LOGIN_RECUSADO",
      result: entry.success ? "SUCESSO" : limited ? "SEGURANCA" : "FALHA",
      identifierType: entry.identifier_type,
      originSummary: entry.device_summary ?? "Dispositivo não identificado",
      ipAddress: entry.ip_address,
      unitName: user.scope_unit_name,
      occurredAt: entry.created_at,
    });
  }
  for (const entry of securityRows.results) {
    const user = userMapByIdentity.get(entry.user_id)!;
    const security = entry.event === "ACESSO_FORA_ESCOPO";
    items.push({
      id: 1_000_000_000 + entry.id,
      userId: user.id,
      userName: user.name,
      username: user.username,
      event: entry.event,
      result: security ? "SEGURANCA" : "SUCESSO",
      identifierType: entry.identifier_type,
      originSummary: entry.reason
        .replaceAll("_", " ")
        .toLocaleLowerCase("pt-BR"),
      ipAddress: null,
      unitName:
        unitNames.get(entry.branch_id ?? entry.matrix_id ?? 0) ??
        user.scope_unit_name,
      occurredAt: entry.created_at,
    });
  }
  for (const entry of adminRows.results) {
    const user = entry.actor_membership_id
      ? userMapByMembership.get(entry.actor_membership_id)
      : userMapByIdentity.get(entry.actor_user_id);
    if (!user) continue;
    items.push({
      id: 2_000_000_000 + entry.id,
      userId: user.id,
      userName: user.name,
      username: user.username,
      event: entry.action,
      result: "SUCESSO",
      identifierType: null,
      originSummary: entry.device_summary ?? "Operação administrativa",
      ipAddress: entry.ip_address,
      unitName: entry.unit_id ? (unitNames.get(entry.unit_id) ?? null) : null,
      occurredAt: entry.created_at,
    });
  }
  items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const search =
    typeof query.search === "string"
      ? query.search.trim().toLocaleLowerCase("pt-BR").slice(0, 120)
      : "";
  const result = ["SUCESSO", "FALHA", "SEGURANCA"].includes(
    String(query.result),
  )
    ? (query.result as AccessResult)
    : null;
  const identifierType = ["CPF", "USUARIO", "EMAIL"].includes(
    String(query.identifierType),
  )
    ? String(query.identifierType)
    : null;
  const from =
    typeof query.dateFrom === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom)
      ? new Date(`${query.dateFrom}T00:00:00.000Z`).getTime()
      : null;
  const to =
    typeof query.dateTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo)
      ? new Date(`${query.dateTo}T23:59:59.999Z`).getTime()
      : null;
  const filtered = items.filter((entry) => {
    const time = new Date(entry.occurredAt).getTime();
    if (result && entry.result !== result) return false;
    if (identifierType && entry.identifierType !== identifierType) return false;
    if (from && time < from) return false;
    if (to && time > to) return false;
    if (
      search &&
      !`${entry.userName} ${entry.username ?? ""} ${entry.originSummary} ${entry.ipAddress ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(search)
    )
      return false;
    return true;
  });
  return paginate(filtered, query.page, query.pageSize);
}

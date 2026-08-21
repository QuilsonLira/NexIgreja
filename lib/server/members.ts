import { generatedId, requirePermission } from "@/lib/server/admin";
import { ApiError, database } from "@/lib/server/auth";
import {
  isValidCpf,
  normalizeBrazilianState,
  normalizeDigits,
  normalizeEmail,
  normalizeOptionalText,
  normalizePhone,
} from "@/lib/server/validation";
import {
  calculateAge,
  canAccessMemberScope,
  formatMemberCode,
  maskCpf,
  memberHistoryEvents,
} from "@/lib/members/policy";
import type {
  EducationLevel,
  MaritalStatus,
  MemberDetail,
  MemberHistoryRecord,
  MemberOptions,
  MemberPage,
  MemberRecord,
  MemberSex,
  MemberStatus,
  MemberWriteInput,
  TheologicalEducation,
} from "@/lib/members/types";
import type { AdministrativeSession, RequestMetadata } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";
import { todayInBrazil } from "@/lib/billing/policy";
import type { ValidatedImageUpload } from "@/lib/server/media";
import {
  resolveEffectiveLogoUrl,
  unitLogoUrl,
  type SupportedImageType,
} from "@/lib/image-policy";
import { customFieldsForTenant, readMemberCustomValues, validateCustomValues } from "@/lib/server/member-custom-fields";

const statuses: MemberStatus[] = [
  "MEMBRO_ATIVO",
  "CONGREGADO",
  "NOVO_CONVERTIDO",
  "VISITANTE",
  "AFASTADO",
  "TRANSFERIDO",
  "DESLIGADO",
  "FALECIDO",
  "INATIVO",
];
const sexes: MemberSex[] = ["MASCULINO", "FEMININO", "NAO_INFORMADO"];
const marital: MaritalStatus[] = [
  "SOLTEIRO",
  "CASADO",
  "DIVORCIADO",
  "VIUVO",
  "UNIAO_ESTAVEL",
  "OUTRO",
  "NAO_INFORMADO",
];
const education: EducationLevel[] = [
  "NAO_INFORMADO",
  "NAO_ALFABETIZADO",
  "FUNDAMENTAL_INCOMPLETO",
  "FUNDAMENTAL_COMPLETO",
  "MEDIO_INCOMPLETO",
  "MEDIO_COMPLETO",
  "SUPERIOR_INCOMPLETO",
  "SUPERIOR_COMPLETO",
  "POS_GRADUACAO",
  "MESTRADO",
  "DOUTORADO",
];
const theology: TheologicalEducation[] = [
  "NAO_INFORMADO",
  "NENHUMA",
  "BASICO",
  "MEDIO",
  "AVANCADO",
  "OUTRO",
];
const stamp = () => new Date().toISOString();
const clean = (v: unknown, max: number) => normalizeOptionalText(v, max);
const choice = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  label: string,
  optional = true,
): T | null => {
  if ((v === null || v === "" || v === undefined) && optional) return null;
  if (!allowed.includes(v as T))
    throw new ApiError(400, "DADOS_INVALIDOS", `${label} inválido.`);
  return v as T;
};
const numberOrNull = (v: unknown): number | null => {
  if (v === null || v === "" || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
function dateValue(v: unknown, label: string): string | null {
  if (v === null || v === "" || v === undefined) return null;
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ||
    v > todayInBrazil()
  )
    throw new ApiError(400, "DATA_INVALIDA", `${label} inválida ou futura.`);
  return v;
}
function asBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

type MemberRow = {
  id: number;
  tenant_id: number;
  member_number: number;
  full_name: string;
  status: MemberStatus;
  birth_date: string | null;
  sex: MemberSex | null;
  cpf: string | null;
  rg: string | null;
  voter_title: string | null;
  birth_city: string | null;
  birth_state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  mother_name: string | null;
  father_name: string | null;
  marital_status: MaritalStatus | null;
  spouse_name: string | null;
  spouse_person_id: number | null;
  spouse_linked_name: string | null;
  children_count: number;
  postal_code: string | null;
  street: string | null;
  address_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  profession: string | null;
  workplace: string | null;
  education_level: EducationLevel | null;
  theological_education: TheologicalEducation | null;
  primary_function_id: number | null;
  function_name: string | null;
  matrix_id: number;
  matrix_name: string;
  branch_id: number | null;
  branch_name: string | null;
  convention_id: number;
  convention_name: string;
  church_entry_date: string | null;
  origin_church: string | null;
  conversion_date: string | null;
  baptism_date: string | null;
  consecration_date: string | null;
  notes: string | null;
  photo_updated_at: string | null;
  branch_logo_updated_at: string | null;
  matrix_logo_updated_at: string | null;
  convention_logo_updated_at: string | null;
  created_at: string;
  updated_at: string;
};
const SELECT = `SELECT p.*,m.name matrix_name,b.name branch_name,c.id convention_id,c.name convention_name,f.name function_name,sp.full_name spouse_linked_name,(SELECT updated_at FROM member_photos ph WHERE ph.person_id=p.id) photo_updated_at,(SELECT updated_at FROM unit_logos l WHERE l.unit_id=b.id) branch_logo_updated_at,(SELECT updated_at FROM unit_logos l WHERE l.unit_id=m.id) matrix_logo_updated_at,(SELECT updated_at FROM unit_logos l WHERE l.unit_id=c.id) convention_logo_updated_at FROM people p JOIN organizational_units m ON m.id=p.matrix_id AND m.tenant_id=p.tenant_id LEFT JOIN organizational_units b ON b.id=p.branch_id AND b.tenant_id=p.tenant_id JOIN organizational_units c ON c.id=m.parent_id AND c.tenant_id=p.tenant_id LEFT JOIN organizational_functions f ON f.id=p.primary_function_id AND f.tenant_id=p.tenant_id LEFT JOIN people sp ON sp.id=p.spouse_person_id AND sp.tenant_id=p.tenant_id`;

async function additionalFunctions(
  personId: number,
  tenantId: number,
): Promise<Array<{ id: number; name: string }>> {
  const r = await database()
    .prepare(
      "SELECT f.id,f.name FROM person_functions pf JOIN organizational_functions f ON f.id=pf.function_id AND f.tenant_id=? WHERE pf.person_id=? AND pf.is_primary=0 AND pf.ended_at IS NULL ORDER BY f.name",
    )
    .bind(tenantId, personId)
    .all<{ id: number; name: string }>();
  return r.results;
}
async function mapMember(
  row: MemberRow,
  showNotes: boolean,
  showCpf = true,
  customVisibility: "admin" | "print" | null = "admin",
): Promise<MemberRecord> {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    memberNumber: row.member_number,
    memberCode: formatMemberCode(row.member_number),
    fullName: row.full_name,
    status: row.status,
    birthDate: row.birth_date,
    age: calculateAge(row.birth_date, todayInBrazil()),
    sex: row.sex,
    cpf: showCpf ? row.cpf : null,
    maskedCpf: maskCpf(row.cpf),
    rg: row.rg,
    voterTitle: row.voter_title,
    birthCity: row.birth_city,
    birthState: row.birth_state,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    motherName: row.mother_name,
    fatherName: row.father_name,
    maritalStatus: row.marital_status,
    spouseName: row.spouse_name,
    spousePersonId: row.spouse_person_id,
    spouseLinkedName: row.spouse_linked_name,
    childrenCount: row.children_count,
    postalCode: row.postal_code,
    street: row.street,
    addressNumber: row.address_number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    profession: row.profession,
    workplace: row.workplace,
    educationLevel: row.education_level,
    theologicalEducation: row.theological_education,
    primaryFunctionId: row.primary_function_id,
    functionName: row.function_name,
    additionalFunctions: await additionalFunctions(row.id, row.tenant_id),
    matrixId: row.matrix_id,
    matrixName: row.matrix_name,
    branchId: row.branch_id,
    branchName: row.branch_name,
    conventionName: row.convention_name,
    churchEntryDate: row.church_entry_date,
    originChurch: row.origin_church,
    conversionDate: row.conversion_date,
    baptismDate: row.baptism_date,
    consecrationDate: row.consecration_date,
    notes: showNotes ? row.notes : null,
    customValues: customVisibility ? await readMemberCustomValues(row.id,row.tenant_id,customVisibility) : [],
    photoUrl: row.photo_updated_at
      ? `/api/media/members/${row.id}/photo?v=${encodeURIComponent(row.photo_updated_at)}`
      : null,
    unitLogoUrl: resolveEffectiveLogoUrl({
      branch: row.branch_id
        ? unitLogoUrl(row.branch_id, row.branch_logo_updated_at)
        : null,
      matrix: unitLogoUrl(row.matrix_id, row.matrix_logo_updated_at),
      convention: unitLogoUrl(
        row.convention_id,
        row.convention_logo_updated_at,
      ),
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function actorCan(
  session: AdministrativeSession,
  row: { tenant_id: number; matrix_id: number; branch_id: number | null },
) {
  return canAccessMemberScope(session.user, {
    tenantId: row.tenant_id,
    matrixId: row.matrix_id,
    branchId: row.branch_id,
  });
}
async function rowById(
  id: number,
  tenantId: number,
): Promise<MemberRow | null> {
  return database()
    .prepare(`${SELECT} WHERE p.id=? AND p.tenant_id=? LIMIT 1`)
    .bind(id, tenantId)
    .first<MemberRow>();
}
async function scopedRow(
  session: AdministrativeSession,
  id: number,
): Promise<MemberRow> {
  const row = await rowById(id, session.user.tenantId);
  if (!row || !actorCan(session, row))
    throw new ApiError(404, "MEMBRO_NAO_ENCONTRADO", "Membro não encontrado.");
  return row;
}

async function validateUnits(
  session: AdministrativeSession,
  matrixId: number | null,
  branchId: number | null,
) {
  if (!matrixId)
    throw new ApiError(400, "MATRIZ_INVALIDA", "Selecione a Matriz do membro.");
  if (session.user.scope === "FILIAL" && !branchId)
    throw new ApiError(
      400,
      "FILIAL_OBRIGATORIA",
      "Seu acesso permite cadastrar membros apenas na própria Filial.",
    );
  const scopeBranchId = session.user.scope === "FILIAL" ? branchId : null;
  const matrix = await database()
    .prepare(
      "SELECT id,tenant_id,type,status,parent_id,archived_at FROM organizational_units WHERE id=? AND tenant_id=?",
    )
    .bind(matrixId, session.user.tenantId)
    .first<{
      id: number;
      tenant_id: number;
      type: string;
      status: string;
      parent_id: number | null;
      archived_at: string | null;
    }>();
  if (
    !matrix ||
    matrix.type !== "MATRIZ" ||
    matrix.status !== "ATIVO" ||
    matrix.archived_at ||
    !canAccessMemberScope(session.user, {
      tenantId: session.user.tenantId,
      matrixId,
      branchId: scopeBranchId,
    })
  )
    throw new ApiError(
      400,
      "MATRIZ_INVALIDA",
      "A Matriz selecionada não está disponível no seu escopo.",
    );
  if (branchId) {
    const branch = await database()
      .prepare(
        "SELECT id,status,parent_id,archived_at FROM organizational_units WHERE id=? AND tenant_id=? AND type='FILIAL'",
      )
      .bind(branchId, session.user.tenantId)
      .first<{
        id: number;
        status: string;
        parent_id: number;
        archived_at: string | null;
      }>();
    if (
      !branch ||
      branch.parent_id !== matrixId ||
      branch.status !== "ATIVO" ||
      branch.archived_at ||
      !canAccessMemberScope(session.user, {
        tenantId: session.user.tenantId,
        matrixId,
        branchId,
      })
    )
      throw new ApiError(
        400,
        "FILIAL_INVALIDA",
        "A Filial selecionada não pertence à Matriz informada ou está fora do seu escopo.",
      );
  }
  return { matrixId, branchId };
}

async function resolveWriteUnits(
  session: AdministrativeSession,
  requestedMatrixId: number | null,
  requestedBranchId: number | null,
) {
  if (session.user.scope === "FILIAL") {
    const branch = await database()
      .prepare("SELECT b.id,b.parent_id,m.id matrix_id FROM organizational_units b JOIN organizational_units m ON m.id=b.parent_id AND m.tenant_id=b.tenant_id WHERE b.id=? AND b.tenant_id=? AND b.type='FILIAL' AND b.status='ATIVO' AND b.archived_at IS NULL AND m.type='MATRIZ' AND m.status='ATIVO' AND m.archived_at IS NULL")
      .bind(session.user.boundBranchId, session.user.tenantId)
      .first<{id:number;parent_id:number;matrix_id:number}>();
    if (!branch) throw new ApiError(409,"HIERARQUIA_INVALIDA","A Filial do seu acesso não possui uma Matriz ativa vinculada.");
    if ((requestedMatrixId && requestedMatrixId !== branch.matrix_id) || (requestedBranchId && requestedBranchId !== branch.id))
      throw new ApiError(403,"UNIDADE_BLOQUEADA","O cadastro deve permanecer vinculado à sua própria Filial.");
    return validateUnits(session, branch.matrix_id, branch.id);
  }
  if (session.user.scope === "MATRIZ") {
    if (requestedMatrixId && requestedMatrixId !== session.user.boundMatrixId)
      throw new ApiError(403,"UNIDADE_BLOQUEADA","A Matriz informada está fora do seu escopo.");
    return validateUnits(session, session.user.boundMatrixId, requestedBranchId);
  }
  return validateUnits(session, requestedMatrixId, requestedBranchId);
}

async function normalizeInput(
  session: AdministrativeSession,
  input: MemberWriteInput,
) {
  const fullName = clean(input.fullName, 180);
  if (!fullName || fullName.length < 2)
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      "Informe o nome completo do membro.",
    );
  const rawCpf = clean(input.cpf, 30);
  const cpf = rawCpf ? normalizeDigits(rawCpf) : null;
  if (cpf && !isValidCpf(cpf))
    throw new ApiError(400, "CPF_INVALIDO", "Informe um CPF válido.");
  const rawEmail = clean(input.email, 254);
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  if (rawEmail && !email)
    throw new ApiError(400, "EMAIL_INVALIDO", "Informe um e-mail válido.");
  const rawPhone = clean(input.phone, 30),
    phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone)
    throw new ApiError(
      400,
      "TELEFONE_INVALIDO",
      "Informe um telefone com DDD.",
    );
  const rawWhatsapp = clean(input.whatsapp, 30),
    whatsapp = rawWhatsapp ? normalizePhone(rawWhatsapp) : null;
  if (rawWhatsapp && !whatsapp)
    throw new ApiError(
      400,
      "WHATSAPP_INVALIDO",
      "Informe um WhatsApp com DDD.",
    );
  const rawVoterTitle=clean(input.voterTitle,30);
  const voterTitle=rawVoterTitle?normalizeDigits(rawVoterTitle):null;
  if(rawVoterTitle&&(!voterTitle||voterTitle.length>20))throw new ApiError(400,"TITULO_ELEITOR_INVALIDO","Informe somente os números do Título de Eleitor.");
  const postalCode = normalizeDigits(input.postalCode);
  if (postalCode && postalCode.length !== 8)
    throw new ApiError(400, "CEP_INVALIDO", "O CEP deve conter 8 dígitos.");
  const birthState = input.birthState
    ? normalizeBrazilianState(input.birthState)
    : null;
  if (input.birthState && !birthState)
    throw new ApiError(
      400,
      "UF_INVALIDA",
      "Informe uma UF de nascimento válida.",
    );
  const state = input.state ? normalizeBrazilianState(input.state) : null;
  if (input.state && !state)
    throw new ApiError(
      400,
      "UF_INVALIDA",
      "Informe uma UF de endereço válida.",
    );
  const resolvedUnits = await resolveWriteUnits(
      session,
      numberOrNull(input.matrixId),
      numberOrNull(input.branchId),
    ),
    matrixId = resolvedUnits.matrixId,
    branchId = resolvedUnits.branchId;
  const primaryFunctionId = numberOrNull(input.primaryFunctionId);
  const additionalFunctionIds = Array.isArray(input.additionalFunctionIds)
    ? [
        ...new Set(
          input.additionalFunctionIds
            .map(numberOrNull)
            .filter((x): x is number => Boolean(x) && x !== primaryFunctionId),
        ),
      ]
    : [];
  const functionIds = [primaryFunctionId, ...additionalFunctionIds].filter(
    (x): x is number => x !== null,
  );
  if (functionIds.length) {
    const placeholders = functionIds.map(() => "?").join(",");
    const found = await database()
      .prepare(
        `SELECT id FROM organizational_functions WHERE tenant_id=? AND status='ATIVO' AND id IN (${placeholders})`,
      )
      .bind(session.user.tenantId, ...functionIds)
      .all<{ id: number }>();
    if (found.results.length !== functionIds.length)
      throw new ApiError(
        400,
        "FUNCAO_INVALIDA",
        "Uma das funções não está ativa ou não pertence a esta instituição.",
      );
  }
  const spousePersonId = numberOrNull(input.spousePersonId);
  if (spousePersonId) {
    const spouse = await rowById(spousePersonId, session.user.tenantId);
    if (!spouse || !actorCan(session, spouse))
      throw new ApiError(
        400,
        "CONJUGE_INVALIDO",
        "A pessoa vinculada como cônjuge não está disponível no seu escopo.",
      );
  }
  const children = Number(input.childrenCount ?? 0);
  if (!Number.isInteger(children) || children < 0 || children > 99)
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      "Quantidade de filhos inválida.",
    );
  const customValues=await validateCustomValues(session.user.tenantId,input.customValues,"admin");
  return {
    fullName,
    status: choice(input.status, statuses, "Situação", false)!,
    birthDate: dateValue(input.birthDate, "Data de nascimento"),
    sex: choice(input.sex, sexes, "Sexo"),
    cpf,
    rg: clean(input.rg, 30),
    birthCity: clean(input.birthCity, 120),
    birthState,
    phone,
    whatsapp,
    email,
    voterTitle,
    motherName: clean(input.motherName, 180),
    fatherName: clean(input.fatherName, 180),
    maritalStatus: choice(input.maritalStatus, marital, "Estado civil"),
    spouseName: clean(input.spouseName, 180),
    spousePersonId,
    childrenCount: children,
    postalCode,
    street: clean(input.street, 180),
    addressNumber: clean(input.addressNumber, 30),
    complement: clean(input.complement, 120),
    district: clean(input.district, 120),
    city: clean(input.city, 120),
    state,
    profession: clean(input.profession, 120),
    workplace: clean(input.workplace, 150),
    educationLevel: choice(input.educationLevel, education, "Escolaridade"),
    theologicalEducation: choice(
      input.theologicalEducation,
      theology,
      "Formação teológica",
    ),
    primaryFunctionId,
    additionalFunctionIds,
    matrixId: matrixId!,
    branchId,
    churchEntryDate: dateValue(input.churchEntryDate, "Data de entrada"),
    originChurch: clean(input.originChurch, 180),
    conversionDate: dateValue(input.conversionDate, "Data de conversão"),
    baptismDate: dateValue(input.baptismDate, "Data de batismo"),
    consecrationDate: dateValue(input.consecrationDate, "Data de consagração"),
    notes: clean(input.notes, 5000),
    customValues,
  };
}

function auditStatement(
  session: AdministrativeSession,
  metadata: RequestMetadata,
  action: string,
  id: number,
  unitId: number | null,
  details: unknown,
) {
  return database()
    .prepare(
      "INSERT INTO administration_audit (actor_user_id,actor_membership_id,tenant_id,convention_id,action,entity_type,entity_id,unit_id,ip_address,user_agent,device_summary,details,created_at) VALUES (?,?,?,?,?,'MEMBRO',?,?,?,?,?,?,?)",
    )
    .bind(
      session.user.id,
      session.user.membershipId,
      session.user.tenantId,
      session.user.conventionId,
      action,
      id,
      unitId,
      metadata.ipAddress,
      metadata.userAgent,
      metadata.deviceSummary,
      JSON.stringify(details),
      stamp(),
    );
}
function historyStatement(
  session: AdministrativeSession,
  id: number,
  type: string,
  description: string,
  eventDate: string | null = null,
  before: unknown = null,
  after: unknown = null,
) {
  return database()
    .prepare(
      "INSERT INTO person_history (tenant_id,person_id,event_type,description,event_date,previous_values,new_values,actor_user_id,actor_membership_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      session.user.tenantId,
      id,
      type,
      description,
      eventDate,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      session.user.id,
      session.user.membershipId,
      stamp(),
    );
}

export async function memberOptions(request: Request): Promise<MemberOptions> {
  const { session } = await requirePermission(request, "MEMBROS_VISUALIZAR");
  const [units, functions, spouses, customFields] = await Promise.all([
    database()
      .prepare(
        "SELECT id,name,type,parent_id FROM organizational_units WHERE tenant_id=? AND archived_at IS NULL AND status='ATIVO' AND type IN ('MATRIZ','FILIAL') ORDER BY name COLLATE NOCASE",
      )
      .bind(session.user.tenantId)
      .all<{ id: number; name: string; type: string; parent_id: number | null }>(),
    database()
      .prepare(
        "SELECT id,name FROM organizational_functions WHERE tenant_id=? AND status='ATIVO' ORDER BY name COLLATE NOCASE",
      )
      .bind(session.user.tenantId)
      .all<{ id: number; name: string }>(),
    database()
      .prepare(
        "SELECT id,member_number,full_name,matrix_id,branch_id FROM people WHERE tenant_id=? ORDER BY full_name COLLATE NOCASE LIMIT 500",
      )
      .bind(session.user.tenantId)
      .all<{
        id: number;
        member_number: number;
        full_name: string;
        matrix_id: number;
        branch_id: number | null;
      }>(),
    customFieldsForTenant(session.user.tenantId,"admin",false),
  ]);
  const boundBranch = session.user.scope === "FILIAL"
      ? units.results.find((u) => u.type === "FILIAL" && u.id === session.user.boundBranchId)
      : null,
    effectiveMatrixId = session.user.scope === "FILIAL"
      ? boundBranch?.parent_id ?? null
      : session.user.scope === "MATRIZ"
        ? session.user.boundMatrixId
        : null;
  const matrices = units.results
    .filter((u) => {
      if (u.type !== "MATRIZ") return false;
      if (session.user.scope === "FILIAL" || session.user.scope === "MATRIZ") return u.id === effectiveMatrixId;
      return canAccessMemberScope(session.user, {
        tenantId: session.user.tenantId,
        matrixId: u.id,
        branchId: null,
      });
    })
    .map((u) => ({ id: u.id, name: u.name }));
  const matrixSet = new Set(matrices.map((m) => m.id));
  const branches = units.results
    .filter(
      (u) =>
        u.type === "FILIAL" &&
        u.parent_id !== null &&
        matrixSet.has(u.parent_id) &&
        canAccessMemberScope(session.user, {
          tenantId: session.user.tenantId,
          matrixId: u.parent_id,
          branchId: u.id,
        }),
    )
    .map((u) => ({ id: u.id, name: u.name, matrixId: u.parent_id! }));
  return {
    matrices,
    branches,
    unitContext: {
      scope: session.user.scope,
      matrixId: effectiveMatrixId,
      branchId: session.user.scope === "FILIAL" ? session.user.boundBranchId : null,
      matrixLocked: session.user.scope !== "CONVENCAO",
      branchLocked: session.user.scope === "FILIAL",
    },
    functions: functions.results,
    customFields,
    spouses: spouses.results
      .filter((p) =>
        canAccessMemberScope(session.user, {
          tenantId: session.user.tenantId,
          matrixId: p.matrix_id,
          branchId: p.branch_id,
        }),
      )
      .map((p) => ({
        id: p.id,
        memberCode: formatMemberCode(p.member_number),
        fullName: p.full_name,
      })),
  };
}

export async function listMembers(
  request: Request,
  query: Record<string, unknown>,
): Promise<MemberPage> {
  const { session, permissions } = await requirePermission(
    request,
    "MEMBROS_VISUALIZAR",
  );
  const where = ["p.tenant_id=?"],
    bindings: unknown[] = [session.user.tenantId];
  if (session.user.scope === "MATRIZ") {
    where.push("p.matrix_id=?");
    bindings.push(session.user.boundMatrixId);
  } else if (session.user.scope === "FILIAL") {
    where.push("p.branch_id=?");
    bindings.push(session.user.boundBranchId);
  }
  const search =
    typeof query.search === "string" ? query.search.trim().slice(0, 120) : "";
  if (search) {
    const digits = search.replace(/\D/g, "");
    where.push(
      "(p.full_name LIKE ? COLLATE NOCASE OR printf('%06d',p.member_number) LIKE ? OR p.cpf LIKE ? OR p.rg LIKE ? COLLATE NOCASE OR p.voter_title LIKE ? OR p.phone LIKE ? OR p.email LIKE ? COLLATE NOCASE OR EXISTS (SELECT 1 FROM member_custom_values cv WHERE cv.person_id=p.id AND cv.tenant_id=p.tenant_id AND cv.value_text LIKE ? COLLATE NOCASE))",
    );
    const q = `%${search}%`;
    bindings.push(q, q, `%${digits || search}%`, q, `%${digits || search}%`, `%${digits || search}%`, q, q);
  }
  for (const [key, column, allowed] of [
    ["status", "p.status", statuses],
    ["sex", "p.sex", sexes],
    ["educationLevel", "p.education_level", education],
    ["theologicalEducation", "p.theological_education", theology],
  ] as const) {
    if (
      typeof query[key] === "string" &&
      (allowed as readonly string[]).includes(query[key] as string)
    ) {
      where.push(`${column}=?`);
      bindings.push(query[key]);
    }
  }
  for (const [key, column] of [
    ["matrixId", "p.matrix_id"],
    ["branchId", "p.branch_id"],
  ] as const) {
    const id = numberOrNull(query[key]);
    if (id) {
      where.push(`${column}=?`);
      bindings.push(id);
    }
  }
  const functionId = numberOrNull(query.functionId);
  if (functionId) {
    where.push("(p.primary_function_id=? OR EXISTS (SELECT 1 FROM person_functions pf WHERE pf.person_id=p.id AND pf.function_id=? AND pf.ended_at IS NULL))");
    bindings.push(functionId, functionId);
  }
  const page = Math.max(1, Number(query.page) || 1),
    pageSize = Math.min(50, Math.max(5, Number(query.pageSize) || 12));
  const total = Number(
    (
      await database()
        .prepare(
          `SELECT COUNT(*) total FROM people p WHERE ${where.join(" AND ")}`,
        )
        .bind(...bindings)
        .first<{ total: number }>()
    )?.total ?? 0,
  );
  const order =
    (
      {
        name: "p.full_name COLLATE NOCASE",
        code: "p.member_number",
        birth: "p.birth_date",
        created: "p.created_at",
      } as Record<string, string>
    )[String(query.order)] ?? "p.full_name COLLATE NOCASE";
  const rows = await database()
    .prepare(
      `${SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} ${query.direction === "desc" ? "DESC" : "ASC"} LIMIT ? OFFSET ?`,
    )
    .bind(...bindings, pageSize, (page - 1) * pageSize)
    .all<MemberRow>();
  const showNotes = permissions.has("MEMBROS_OBSERVACOES_VISUALIZAR");
  return {
    items: await Promise.all(
      rows.results.map((r) => mapMember(r, showNotes, false, null)),
    ),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getMember(
  request: Request,
  id: number,
  forPrint = false,
): Promise<MemberDetail> {
  const required: PermissionCode = forPrint
    ? "MEMBROS_IMPRIMIR"
    : "MEMBROS_VISUALIZAR";
  const { session, permissions } = await requirePermission(request, required);
  const row = await scopedRow(session, id);
  const member = await mapMember(
    row,
    permissions.has("MEMBROS_OBSERVACOES_VISUALIZAR"),
    true,
    forPrint?"print":"admin",
  );
  let history: MemberHistoryRecord[] = [];
  if (permissions.has("MEMBROS_HISTORICO_VISUALIZAR")) {
    const result = await database()
      .prepare(
        "SELECT h.id,h.event_type eventType,h.description,h.event_date eventDate,u.name actorName,h.created_at createdAt FROM person_history h JOIN auth_users u ON u.id=h.actor_user_id WHERE h.tenant_id=? AND h.person_id=? ORDER BY h.id DESC",
      )
      .bind(session.user.tenantId, id)
      .all<MemberHistoryRecord>();
    history = result.results;
  }
  return { member, history };
}

export async function createMember(
  request: Request,
  input: MemberWriteInput,
): Promise<MemberRecord> {
  const { session, permissions, metadata } = await requirePermission(
    request,
    "MEMBROS_CRIAR",
  );
  const v = await normalizeInput(session, input);
  if (v.notes && !permissions.has("MEMBROS_OBSERVACOES_EDITAR"))
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "Você não possui permissão para registrar observações internas.",
    );
  if (
    v.cpf &&
    (await database()
      .prepare("SELECT 1 found FROM people WHERE tenant_id=? AND cpf=?")
      .bind(session.user.tenantId, v.cpf)
      .first())
  )
    throw new ApiError(
      409,
      "CPF_DUPLICADO",
      "Já existe um membro com este CPF nesta instituição.",
    );
  let memberNumber: number;
  if (input.importMode === true && numberOrNull(input.memberNumber)) {
    memberNumber = numberOrNull(input.memberNumber)!;
    await database()
      .prepare(
        "INSERT INTO member_sequences (tenant_id,last_number,updated_at) VALUES (?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET last_number=MAX(last_number,excluded.last_number),updated_at=excluded.updated_at",
      )
      .bind(session.user.tenantId, memberNumber, stamp())
      .run();
  } else {
    const seq = await database()
      .prepare(
        "INSERT INTO member_sequences (tenant_id,last_number,updated_at) VALUES (?,1,?) ON CONFLICT(tenant_id) DO UPDATE SET last_number=last_number+1,updated_at=excluded.updated_at RETURNING last_number",
      )
      .bind(session.user.tenantId, stamp())
      .first<{ last_number: number }>();
    memberNumber = seq!.last_number;
  }
  const id = generatedId(),
    created = stamp();
  const statements: D1PreparedStatement[] = [
    database()
      .prepare(
        "INSERT INTO people (id,tenant_id,member_number,full_name,status,birth_date,sex,cpf,rg,voter_title,birth_city,birth_state,phone,whatsapp,email,mother_name,father_name,marital_status,spouse_name,spouse_person_id,children_count,postal_code,street,address_number,complement,district,city,state,profession,workplace,education_level,theological_education,primary_function_id,matrix_id,branch_id,church_entry_date,origin_church,conversion_date,baptism_date,consecration_date,notes,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        session.user.tenantId,
        memberNumber,
        v.fullName,
        v.status,
        v.birthDate,
        v.sex,
        v.cpf,
        v.rg,
        v.voterTitle,
        v.birthCity,
        v.birthState,
        v.phone,
        v.whatsapp,
        v.email,
        v.motherName,
        v.fatherName,
        v.maritalStatus,
        v.spouseName,
        v.spousePersonId,
        v.childrenCount,
        v.postalCode,
        v.street,
        v.addressNumber,
        v.complement,
        v.district,
        v.city,
        v.state,
        v.profession,
        v.workplace,
        v.educationLevel,
        v.theologicalEducation,
        v.primaryFunctionId,
        v.matrixId,
        v.branchId,
        v.churchEntryDate,
        v.originChurch,
        v.conversionDate,
        v.baptismDate,
        v.consecrationDate,
        v.notes,
        session.user.id,
        created,
        created,
      ),
    historyStatement(
      session,
      id,
      "CADASTRO_REALIZADO",
      `Membro cadastrado com o código ${formatMemberCode(memberNumber)}.`,
    ),
    auditStatement(
      session,
      metadata,
      "MEMBRO_CRIADO",
      id,
      v.branchId ?? v.matrixId,
      { memberCode: formatMemberCode(memberNumber), name: v.fullName },
    ),
  ];
  for (const functionId of [
    v.primaryFunctionId,
    ...v.additionalFunctionIds,
  ].filter((x): x is number => x !== null))
    statements.push(
      database()
        .prepare(
          "INSERT INTO person_functions (person_id,tenant_id,function_id,is_primary,started_at,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          id,
          session.user.tenantId,
          functionId,
          functionId === v.primaryFunctionId ? 1 : 0,
          created.slice(0, 10),
          created,
        ),
    );
  if (v.spousePersonId)
    statements.push(
      database()
        .prepare(
          "INSERT INTO person_relationships (id,tenant_id,person_id,related_person_id,relationship_type,created_at) VALUES (?, ?, ?, ?, 'CONJUGE', ?)",
        )
        .bind(
          generatedId(),
          session.user.tenantId,
          id,
          v.spousePersonId,
          created,
        ),
    );
  for(const item of v.customValues)if(item.value!==null)statements.push(database().prepare("INSERT INTO member_custom_values (person_id,tenant_id,field_id,value_text,updated_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,session.user.tenantId,item.field.id,item.value,session.user.id,created,created));
  await database().batch(statements);
  return mapMember(
    (await rowById(id, session.user.tenantId))!,
    permissions.has("MEMBROS_OBSERVACOES_VISUALIZAR"),
  );
}

export async function updateMember(
  request: Request,
  id: number,
  input: MemberWriteInput,
): Promise<MemberRecord> {
  const { session, permissions, metadata } = await requirePermission(
    request,
    "MEMBROS_EDITAR",
  );
  const before = await scopedRow(session, id);
  const v = await normalizeInput(session, input);
  if (
    v.status !== before.status &&
    !permissions.has("MEMBROS_ALTERAR_SITUACAO")
  )
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "Você não possui permissão para alterar a situação do membro.",
    );
  if (
    (v.matrixId !== before.matrix_id || v.branchId !== before.branch_id) &&
    !permissions.has("MEMBROS_TRANSFERIR")
  )
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "Você não possui permissão para transferir membros.",
    );
  // A edição geral nunca deve apagar observações que o operador não pode ver.
  const effectiveNotes = permissions.has("MEMBROS_OBSERVACOES_EDITAR")
    ? v.notes
    : before.notes;
  if (
    v.cpf &&
    (await database()
      .prepare(
        "SELECT 1 found FROM people WHERE tenant_id=? AND cpf=? AND id<>?",
      )
      .bind(session.user.tenantId, v.cpf, id)
      .first())
  )
    throw new ApiError(
      409,
      "CPF_DUPLICADO",
      "Já existe um membro com este CPF nesta instituição.",
    );
  const updated = stamp();
  const statements: D1PreparedStatement[] = [
    database()
      .prepare(
        "UPDATE people SET full_name=?,status=?,birth_date=?,sex=?,cpf=?,rg=?,voter_title=?,birth_city=?,birth_state=?,phone=?,whatsapp=?,email=?,mother_name=?,father_name=?,marital_status=?,spouse_name=?,spouse_person_id=?,children_count=?,postal_code=?,street=?,address_number=?,complement=?,district=?,city=?,state=?,profession=?,workplace=?,education_level=?,theological_education=?,primary_function_id=?,matrix_id=?,branch_id=?,church_entry_date=?,origin_church=?,conversion_date=?,baptism_date=?,consecration_date=?,notes=?,updated_at=? WHERE id=? AND tenant_id=?",
      )
      .bind(
        v.fullName,
        v.status,
        v.birthDate,
        v.sex,
        v.cpf,
        v.rg,
        v.voterTitle,
        v.birthCity,
        v.birthState,
        v.phone,
        v.whatsapp,
        v.email,
        v.motherName,
        v.fatherName,
        v.maritalStatus,
        v.spouseName,
        v.spousePersonId,
        v.childrenCount,
        v.postalCode,
        v.street,
        v.addressNumber,
        v.complement,
        v.district,
        v.city,
        v.state,
        v.profession,
        v.workplace,
        v.educationLevel,
        v.theologicalEducation,
        v.primaryFunctionId,
        v.matrixId,
        v.branchId,
        v.churchEntryDate,
        v.originChurch,
        v.conversionDate,
        v.baptismDate,
        v.consecrationDate,
        effectiveNotes,
        updated,
        id,
        session.user.tenantId,
      ),
    database()
      .prepare("DELETE FROM person_functions WHERE person_id=?")
      .bind(id),
    database()
      .prepare(
        "DELETE FROM person_relationships WHERE tenant_id=? AND person_id=? AND relationship_type='CONJUGE'",
      )
      .bind(session.user.tenantId, id),
  ];
  for (const functionId of [
    v.primaryFunctionId,
    ...v.additionalFunctionIds,
  ].filter((x): x is number => x !== null))
    statements.push(
      database()
        .prepare(
          "INSERT INTO person_functions (person_id,tenant_id,function_id,is_primary,started_at,created_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(
          id,
          session.user.tenantId,
          functionId,
          functionId === v.primaryFunctionId ? 1 : 0,
          updated.slice(0, 10),
          updated,
        ),
    );
  if (v.spousePersonId)
    statements.push(
      database()
        .prepare(
          "INSERT INTO person_relationships (id,tenant_id,person_id,related_person_id,relationship_type,created_at) VALUES (?, ?, ?, ?, 'CONJUGE', ?)",
        )
        .bind(
          generatedId(),
          session.user.tenantId,
          id,
          v.spousePersonId,
          updated,
        ),
    );
  for(const item of v.customValues){statements.push(database().prepare("DELETE FROM member_custom_values WHERE person_id=? AND tenant_id=? AND field_id=?").bind(id,session.user.tenantId,item.field.id));if(item.value!==null)statements.push(database().prepare("INSERT INTO member_custom_values (person_id,tenant_id,field_id,value_text,updated_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,session.user.tenantId,item.field.id,item.value,session.user.id,updated,updated));}
  const events = memberHistoryEvents(
    {
      status: before.status,
      matrixId: before.matrix_id,
      branchId: before.branch_id,
      primaryFunctionId: before.primary_function_id,
      baptismDate: before.baptism_date,
      consecrationDate: before.consecration_date,
    },
    {
      status: v.status,
      matrixId: v.matrixId,
      branchId: v.branchId,
      primaryFunctionId: v.primaryFunctionId,
      baptismDate: v.baptismDate,
      consecrationDate: v.consecrationDate,
    },
  );
  for (const e of events)
    statements.push(
      historyStatement(
        session,
        id,
        e.type,
        e.description,
        null,
        {
          status: before.status,
          matrixId: before.matrix_id,
          branchId: before.branch_id,
          primaryFunctionId: before.primary_function_id,
        },
        {
          status: v.status,
          matrixId: v.matrixId,
          branchId: v.branchId,
          primaryFunctionId: v.primaryFunctionId,
        },
      ),
    );
  statements.push(
    auditStatement(
      session,
      metadata,
      "MEMBRO_EDITADO",
      id,
      v.branchId ?? v.matrixId,
      {
        sensitiveChanges: events.map((e) => e.type),
        cpfChanged: v.cpf !== before.cpf,
      },
    ),
  );
  await database().batch(statements);
  return mapMember(
    (await rowById(id, session.user.tenantId))!,
    permissions.has("MEMBROS_OBSERVACOES_VISUALIZAR"),
  );
}

export async function updateMemberPhoto(
  request: Request,
  id: number,
  upload: ValidatedImageUpload | null,
): Promise<string | null> {
  const { session, metadata } = await requirePermission(
    request,
    "MEMBROS_EDITAR",
  );
  const member = await scopedRow(session, id);
  const updated = stamp();
  const statements: D1PreparedStatement[] = [];
  if (upload)
    statements.push(
      database()
        .prepare(
          "INSERT INTO member_photos (person_id,tenant_id,image_data,mime_type,byte_size,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET image_data=excluded.image_data,mime_type=excluded.mime_type,byte_size=excluded.byte_size,tenant_id=excluded.tenant_id,updated_at=excluded.updated_at",
        )
        .bind(
          id,
          session.user.tenantId,
          asBuffer(upload.bytes),
          upload.mimeType,
          upload.bytes.byteLength,
          updated,
        ),
    );
  else
    statements.push(
      database()
        .prepare("DELETE FROM member_photos WHERE person_id=? AND tenant_id=?")
        .bind(id, session.user.tenantId),
    );
  statements.push(
    auditStatement(
      session,
      metadata,
      upload ? "FOTO_MEMBRO_ATUALIZADA" : "FOTO_MEMBRO_REMOVIDA",
      id,
      member.branch_id ?? member.matrix_id,
      {},
    ),
  );
  await database().batch(statements);
  return upload
    ? `/api/media/members/${id}/photo?v=${encodeURIComponent(updated)}`
    : null;
}
export async function readMemberPhoto(
  request: Request,
  id: number,
): Promise<{
  image_data: ArrayBuffer | Uint8Array;
  mime_type: SupportedImageType;
  byte_size: number;
  updated_at: string;
}> {
  const { session } = await requirePermission(request, "MEMBROS_VISUALIZAR");
  await scopedRow(session, id);
  const photo = await database()
    .prepare(
      "SELECT image_data,mime_type,byte_size,updated_at FROM member_photos WHERE person_id=? AND tenant_id=?",
    )
    .bind(id, session.user.tenantId)
    .first<{
      image_data: ArrayBuffer | Uint8Array;
      mime_type: SupportedImageType;
      byte_size: number;
      updated_at: string;
    }>();
  if (!photo)
    throw new ApiError(404, "IMAGEM_NAO_ENCONTRADA", "Foto não encontrada.");
  return photo;
}

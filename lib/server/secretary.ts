import { ApiError, database } from "@/lib/server/auth";
import { generatedId, requirePermission } from "@/lib/server/admin";
import type { AdministrativeSession } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";
import { canAccessMemberScope, formatMemberCode } from "@/lib/members/policy";

const now = () => new Date().toISOString();
const clean = (value: unknown, max = 500) =>
  typeof value === "string"
    ? value.trim().replace(/[<>]/g, "").slice(0, max)
    : "";
const id = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const date = (value: unknown) => {
  const result = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result))
    throw new ApiError(400, "DATA_INVALIDA", "Informe uma data válida.");
  return result;
};
type Ctx = { session: AdministrativeSession; permissions: Set<PermissionCode> };
type PersonRow = {
  id: number;
  tenant_id: number;
  member_number: number;
  full_name: string;
  status: string;
  birth_date: string | null;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  whatsapp: string | null;
  matrix_id: number;
  branch_id: number | null;
  primary_function_id: number | null;
  baptism_date: string | null;
  consecration_date: string | null;
};
const personSelect =
  "SELECT id,tenant_id,member_number,full_name,status,birth_date,cpf,rg,phone,whatsapp,matrix_id,branch_id,primary_function_id,baptism_date,consecration_date FROM people";
function scopeUnit(session: AdministrativeSession, column: string) {
  if (session.user.scope === "FILIAL")
    return { sql: `${column}=?`, args: [session.user.boundBranchId] };
  if (session.user.scope === "MATRIZ")
    return {
      sql: `(${column}=? OR EXISTS(SELECT 1 FROM organizational_units scope_child WHERE scope_child.id=${column} AND scope_child.tenant_id=? AND scope_child.parent_id=?))`,
      args: [
        session.user.boundMatrixId,
        session.user.tenantId,
        session.user.boundMatrixId,
      ],
    };
  return {
    sql: `EXISTS(SELECT 1 FROM organizational_units scope_unit LEFT JOIN organizational_units scope_parent ON scope_parent.id=scope_unit.parent_id AND scope_parent.tenant_id=scope_unit.tenant_id WHERE scope_unit.id=${column} AND scope_unit.tenant_id=? AND (scope_unit.id=? OR scope_unit.parent_id=? OR scope_parent.parent_id=?))`,
    args: [
      session.user.tenantId,
      session.user.conventionId,
      session.user.conventionId,
      session.user.conventionId,
    ],
  };
}
function requestVisibilityScope(session: AdministrativeSession, originColumn: string, destinationColumn: string) {
  const origin = scopeUnit(session, originColumn), destination = scopeUnit(session, destinationColumn);
  return { sql: `((${origin.sql}) OR (${destination.sql}))`, args: [...origin.args, ...destination.args] };
}
function actorOwnsUnit(session:AdministrativeSession,unitId:number,parentId:number|null){if(session.user.scope==="CONVENCAO")return true;if(session.user.scope==="MATRIZ")return unitId===session.user.boundMatrixId||parentId===session.user.boundMatrixId;return unitId===session.user.boundBranchId;}
function personInScope(session: AdministrativeSession, person: PersonRow) {
  return canAccessMemberScope(session.user, {
    tenantId: person.tenant_id,
    matrixId: person.matrix_id,
    branchId: person.branch_id,
  });
}
async function person(ctx: Ctx, personId: number) {
  const row = await database()
    .prepare(`${personSelect} WHERE id=? AND tenant_id=?`)
    .bind(personId, ctx.session.user.tenantId)
    .first<PersonRow>();
  if (!row || !personInScope(ctx.session, row))
    throw new ApiError(404, "PESSOA_NAO_ENCONTRADA", "Pessoa não encontrada.");
  return row;
}
async function unit(ctx: Ctx, unitId: number) {
  const row = await database()
    .prepare(
      "SELECT u.id,u.name,u.type,u.parent_id,u.status,u.archived_at,p.parent_id convention_id FROM organizational_units u LEFT JOIN organizational_units p ON p.id=u.parent_id AND p.tenant_id=u.tenant_id WHERE u.id=? AND u.tenant_id=?",
    )
    .bind(unitId, ctx.session.user.tenantId)
    .first<{
      id: number;
      name: string;
      type: string;
      parent_id: number | null;
      status: string;
      archived_at: string | null;
      convention_id: number | null;
    }>();
  if (!row || row.status !== "ATIVO" || row.archived_at)
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  const matrixId =
      row.type === "MATRIZ"
        ? row.id
        : row.type === "FILIAL"
          ? row.parent_id
          : null,
    branchId = row.type === "FILIAL" ? row.id : null;
  if (
    !matrixId ||
    !canAccessMemberScope(ctx.session.user, {
      tenantId: ctx.session.user.tenantId,
      matrixId,
      branchId,
    })
  )
    throw new ApiError(403, "FORA_DO_ESCOPO", "Unidade fora do seu escopo.");
  return { ...row, matrixId, branchId };
}
async function tenantUnit(ctx: Ctx, unitId: number) {
  const row = await database()
    .prepare("SELECT id,name,type,parent_id,status,archived_at FROM organizational_units WHERE id=? AND tenant_id=? AND type IN ('MATRIZ','FILIAL')")
    .bind(unitId, ctx.session.user.tenantId)
    .first<{id:number;name:string;type:string;parent_id:number|null;status:string;archived_at:string|null}>();
  if (!row || row.status !== "ATIVO" || row.archived_at) throw new ApiError(404,"UNIDADE_NAO_ENCONTRADA","Unidade de destino não encontrada.");
  const matrixId = row.type === "MATRIZ" ? row.id : row.parent_id, branchId = row.type === "FILIAL" ? row.id : null;
  if (!matrixId) throw new ApiError(409,"HIERARQUIA_INVALIDA","A unidade de destino não possui Matriz vinculada.");
  return {...row,matrixId,branchId};
}
async function context(
  request: Request,
  permission: PermissionCode,
): Promise<Ctx> {
  const { session, permissions } = await requirePermission(request, permission);
  return { session, permissions };
}

async function enforceTransferSearchRate(ctx:Ctx){const cutoff=new Date(Date.now()-60_000).toISOString(),stamp=now(),row=await database().prepare("SELECT attempts,window_started_at FROM secretary_transfer_search_limits WHERE tenant_id=? AND user_id=?").bind(ctx.session.user.tenantId,ctx.session.user.id).first<{attempts:number;window_started_at:string}>();if(row&&row.window_started_at>=cutoff&&row.attempts>=60)throw new ApiError(429,"MUITAS_PESQUISAS","Muitas pesquisas em sequência. Aguarde um minuto e tente novamente.");await database().prepare("INSERT INTO secretary_transfer_search_limits(tenant_id,user_id,attempts,window_started_at,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(tenant_id,user_id) DO UPDATE SET attempts=CASE WHEN window_started_at<? THEN 1 ELSE attempts+1 END,window_started_at=CASE WHEN window_started_at<? THEN excluded.window_started_at ELSE window_started_at END,updated_at=excluded.updated_at").bind(ctx.session.user.tenantId,ctx.session.user.id,stamp,stamp,cutoff,cutoff).run();}

function ownDestinationId(session:AdministrativeSession){if(session.user.scope==="FILIAL")return session.user.boundBranchId;if(session.activeContext)return session.activeContext.branchId??session.activeContext.matrixId;return session.user.boundMatrixId;}

export async function transferCandidateOptions(request:Request,query:Record<string,unknown>){const ctx=await context(request,"SECRETARIA_TRANSFERENCIAS_SOLICITAR"),tenant=ctx.session.user.tenantId,ownId=ownDestinationId(ctx.session);if(!ownId)throw new ApiError(409,"CONTEXTO_INVALIDO","Selecione uma unidade válida antes de solicitar o recebimento.");const own=await unit(ctx,ownId),scope=scopeUnit(ctx.session,"u.id"),term=clean(query.search,80);const [destinations,receiveDestinations]=await Promise.all([database().prepare("SELECT id,name,type,parent_id FROM organizational_units WHERE tenant_id=? AND status='ATIVO' AND archived_at IS NULL AND type IN ('MATRIZ','FILIAL') ORDER BY type,name LIMIT 300").bind(tenant).all<Record<string,unknown>>(),database().prepare(`SELECT u.id,u.name,u.type,u.parent_id FROM organizational_units u WHERE u.tenant_id=? AND u.status='ATIVO' AND u.archived_at IS NULL AND u.type IN ('MATRIZ','FILIAL') AND ${scope.sql} ORDER BY u.type,u.name LIMIT 100`).bind(tenant,...scope.args).all<Record<string,unknown>>()]);if(!term)return{candidates:[],destination:{id:own.id,name:own.name,type:own.type},destinationLocked:ctx.session.user.scope==="FILIAL",destinations:destinations.results.filter(row=>Number(row.id)!==own.id),receiveDestinations:receiveDestinations.results};if(term.length<3)throw new ApiError(400,"BUSCA_CURTA","Digite pelo menos 3 caracteres do nome ou código.");await enforceTransferSearchRate(ctx);const q=`%${term}%`,digits=term.replace(/\D/g,""),rows=await database().prepare("SELECT p.id,p.member_number,p.full_name,p.status,COALESCE(b.id,m.id) current_unit_id,COALESCE(b.name,m.name) current_unit_name,CASE WHEN b.id IS NULL THEN 'MATRIZ' ELSE 'FILIAL' END current_unit_type FROM people p JOIN organizational_units m ON m.id=p.matrix_id AND m.tenant_id=p.tenant_id LEFT JOIN organizational_units b ON b.id=p.branch_id AND b.tenant_id=p.tenant_id WHERE p.tenant_id=? AND COALESCE(p.branch_id,p.matrix_id)<>? AND p.status NOT IN ('FALECIDO','TRANSFERIDO','DESLIGADO') AND (p.full_name LIKE ? COLLATE NOCASE OR printf('%06d',p.member_number) LIKE ?) ORDER BY p.full_name COLLATE NOCASE LIMIT 20").bind(tenant,own.id,q,`%${digits||term}%`).all<{id:number;member_number:number;full_name:string;status:string;current_unit_id:number;current_unit_name:string;current_unit_type:string}>();return{candidates:rows.results.map(row=>({id:row.id,full_name:row.full_name,member_code:formatMemberCode(row.member_number),status:row.status,current_unit_id:row.current_unit_id,current_unit_name:row.current_unit_name,current_unit_type:row.current_unit_type})),destination:{id:own.id,name:own.name,type:own.type},destinationLocked:ctx.session.user.scope==="FILIAL",destinations:destinations.results.filter(row=>Number(row.id)!==own.id),receiveDestinations:receiveDestinations.results};}
function audit(
  ctx: Ctx,
  action: string,
  entityType: string,
  entityId: number,
  unitId: number | null,
  before: unknown,
  next: unknown,
  reason: string | null = null,
) {
  return database()
    .prepare(
      "INSERT INTO secretary_audit(tenant_id,unit_id,actor_user_id,actor_membership_id,action,entity_type,entity_id,previous_values,new_values,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      ctx.session.user.tenantId,
      unitId,
      ctx.session.user.id,
      ctx.session.user.membershipId,
      action,
      entityType,
      entityId,
      before ? JSON.stringify(before) : null,
      next ? JSON.stringify(next) : null,
      reason,
      now(),
    );
}
function history(
  ctx: Ctx,
  personId: number,
  type: string,
  description: string,
  eventDate: string,
  previous: unknown = null,
  next: unknown = null,
) {
  return database()
    .prepare(
      "INSERT INTO person_history(tenant_id,person_id,event_type,description,event_date,previous_values,new_values,actor_user_id,actor_membership_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      ctx.session.user.tenantId,
      personId,
      type,
      description,
      eventDate,
      previous ? JSON.stringify(previous) : null,
      next ? JSON.stringify(next) : null,
      ctx.session.user.id,
      ctx.session.user.membershipId,
      now(),
    );
}
async function recipients(ctx: Ctx, unitIds: number[]) {
  const valid = [...new Set(unitIds.filter(Boolean))];
  if (!valid.length) return [];
  const placeholders = valid.map(() => "?").join(",");
  const rows = await database()
    .prepare(
      `SELECT DISTINCT m.user_id FROM tenant_memberships m JOIN membership_permissions mp ON mp.membership_id=m.id WHERE m.tenant_id=? AND m.status='ATIVO' AND m.archived_at IS NULL AND mp.permission IN ('SECRETARIA_TRANSFERENCIAS_APROVAR','SECRETARIA_VISUALIZAR') AND (m.scope='CONVENCAO' OR m.scope_unit_id IN (${placeholders}) OR EXISTS(SELECT 1 FROM organizational_units u WHERE u.id IN (${placeholders}) AND u.parent_id=m.scope_unit_id))`,
    )
    .bind(ctx.session.user.tenantId, ...valid, ...valid)
    .all<{ user_id: number }>();
  return rows.results.map((row) => row.user_id);
}
function notify(
  ctx: Ctx,
  type: string,
  title: string,
  message: string,
  route: string,
  source: string,
  sourceId: number,
  unitId: number,
  userIds: number[],
) {
  if (!userIds.length) return [];
  const notificationId = generatedId(),
    stamp = now();
  return [
    database()
      .prepare(
        "INSERT INTO notifications(id,tenant_id,audience,type,title,message,priority,internal_route,source_entity,source_entity_id,unit_id,group_key,metadata_json,mandatory,created_at,updated_at) VALUES(?,?,'ORGANIZATIONAL',?,?,?,'ATENCAO',?,?,?,?,?,NULL,0,?,?)",
      )
      .bind(
        notificationId,
        ctx.session.user.tenantId,
        type,
        title,
        message,
        route,
        source,
        sourceId,
        unitId,
        `${type}:${sourceId}`,
        stamp,
        stamp,
      ),
    ...userIds.map((userId) =>
      database()
        .prepare(
          "INSERT OR IGNORE INTO notification_recipients(notification_id,user_id,created_at) VALUES(?,?,?)",
        )
        .bind(notificationId, userId, stamp),
    ),
  ];
}

export async function secretaryOverview(
  request: Request,
  query: Record<string, unknown>,
) {
  const ctx = await context(request, "SECRETARIA_VISUALIZAR"),
    tenant = ctx.session.user.tenantId,
    page = Math.max(1, Number(query.page) || 1),
    pageSize = Math.min(50, Math.max(5, Number(query.pageSize) || 20)),
    scope = scopeUnit(ctx.session, "COALESCE(p.branch_id,p.matrix_id)"),
    requestScope = requestVisibilityScope(ctx.session,"r.origin_unit_id","r.destination_unit_id"),
    movementScope = scopeUnit(ctx.session, "m.unit_id");
  const [
    dashboard,
    requests,
    movements,
    baptisms,
    baptismCandidates,
    consecrations,
    templates,
    documents,
  ] = await Promise.all([
    database()
      .prepare(
        `SELECT (SELECT COUNT(*) FROM secretary_requests r JOIN people p ON p.id=r.person_id AND p.tenant_id=r.tenant_id WHERE r.tenant_id=? AND r.status IN ('PENDENTE','EM_ANALISE') AND ${requestScope.sql}) pending_requests,(SELECT COUNT(*) FROM secretary_requests r JOIN people p ON p.id=r.person_id AND p.tenant_id=r.tenant_id WHERE r.tenant_id=? AND r.request_type='DOCUMENTO' AND r.status IN ('PENDENTE','EM_ANALISE') AND ${requestScope.sql}) pending_documents,(SELECT COUNT(*) FROM baptism_candidates b JOIN people p ON p.id=b.person_id AND p.tenant_id=b.tenant_id WHERE b.tenant_id=? AND b.status<>'REALIZADO' AND b.status<>'CANCELADO' AND ${scope.sql}) baptism_candidates,(SELECT COUNT(*) FROM church_movements m WHERE m.tenant_id=? AND m.effective_date>=date('now','start of month') AND ${movementScope.sql}) month_movements`,
      )
      .bind(
        tenant,
        ...requestScope.args,
        tenant,
        ...requestScope.args,
        tenant,
        ...scope.args,
        tenant,
        ...movementScope.args,
      )
      .first<Record<string, number>>(),
    database()
      .prepare(
        `SELECT r.*,p.full_name,p.member_number,ou.name origin_name,ou.parent_id origin_parent_id,du.name destination_name FROM secretary_requests r JOIN people p ON p.id=r.person_id AND p.tenant_id=r.tenant_id LEFT JOIN organizational_units ou ON ou.id=r.origin_unit_id AND ou.tenant_id=r.tenant_id LEFT JOIN organizational_units du ON du.id=r.destination_unit_id AND du.tenant_id=r.tenant_id WHERE r.tenant_id=? AND ${requestScope.sql} ORDER BY CASE r.status WHEN 'PENDENTE' THEN 0 WHEN 'EM_ANALISE' THEN 1 ELSE 2 END,r.requested_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(tenant, ...requestScope.args, pageSize, (page - 1) * pageSize)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        `SELECT m.*,p.full_name,p.member_number,u.name unit_name FROM church_movements m JOIN people p ON p.id=m.person_id AND p.tenant_id=m.tenant_id JOIN organizational_units u ON u.id=m.unit_id AND u.tenant_id=m.tenant_id WHERE m.tenant_id=? AND ${movementScope.sql} ORDER BY m.effective_date DESC,m.created_at DESC LIMIT 100`,
      )
      .bind(tenant, ...movementScope.args)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        `SELECT e.*,u.name unit_name,COUNT(c.person_id) candidate_count,SUM(c.status='REALIZADO') completed_count FROM baptism_events e JOIN organizational_units u ON u.id=e.unit_id AND u.tenant_id=e.tenant_id LEFT JOIN baptism_candidates c ON c.event_id=e.id AND c.tenant_id=e.tenant_id WHERE e.tenant_id=? AND ${scopeUnit(ctx.session, "e.unit_id").sql} GROUP BY e.id ORDER BY e.scheduled_date DESC LIMIT 100`,
      )
      .bind(tenant, ...scopeUnit(ctx.session, "e.unit_id").args)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        `SELECT c.*,p.full_name,p.member_number,p.baptism_date,e.title event_title,e.scheduled_date,e.unit_id,u.name unit_name FROM baptism_candidates c JOIN baptism_events e ON e.id=c.event_id AND e.tenant_id=c.tenant_id JOIN people p ON p.id=c.person_id AND p.tenant_id=c.tenant_id JOIN organizational_units u ON u.id=e.unit_id AND u.tenant_id=e.tenant_id WHERE c.tenant_id=? AND ${scopeUnit(ctx.session, "e.unit_id").sql} ORDER BY e.scheduled_date DESC,p.full_name LIMIT 300`,
      )
      .bind(tenant, ...scopeUnit(ctx.session, "e.unit_id").args)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        `SELECT c.*,p.full_name,p.member_number,f.name new_function_name,u.name unit_name FROM consecrations c JOIN people p ON p.id=c.person_id AND p.tenant_id=c.tenant_id JOIN organizational_functions f ON f.id=c.new_function_id AND f.tenant_id=c.tenant_id JOIN organizational_units u ON u.id=c.unit_id WHERE c.tenant_id=? AND ${scopeUnit(ctx.session, "c.unit_id").sql} ORDER BY c.event_date DESC LIMIT 100`,
      )
      .bind(tenant, ...scopeUnit(ctx.session, "c.unit_id").args)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT t.*,v.title,v.body,v.header_text,v.footer_text,v.signature_labels_json FROM secretary_document_templates t JOIN secretary_document_template_versions v ON v.template_id=t.id AND v.version=t.current_version WHERE t.tenant_id=? ORDER BY t.status,t.name LIMIT 100",
      )
      .bind(tenant)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        `SELECT d.id,d.document_number,d.document_type,d.title_snapshot,d.issued_at,p.full_name,u.name unit_name FROM secretary_documents d JOIN people p ON p.id=d.person_id AND p.tenant_id=d.tenant_id JOIN organizational_units u ON u.id=d.unit_id AND u.tenant_id=d.tenant_id WHERE d.tenant_id=? AND ${scopeUnit(ctx.session, "d.unit_id").sql} ORDER BY d.issued_at DESC LIMIT 100`,
      )
      .bind(tenant, ...scopeUnit(ctx.session, "d.unit_id").args)
      .all<Record<string, unknown>>(),
  ]);
  return {
    dashboard: dashboard ?? {},
    requests: requests.results.map(row=>({...row,can_review:actorOwnsUnit(ctx.session,Number(row.origin_unit_id),row.origin_parent_id?Number(row.origin_parent_id):null)})),
    movements: movements.results,
    baptisms: baptisms.results,
    baptismCandidates: baptismCandidates.results,
    consecrations: consecrations.results,
    templates: templates.results.map((row) => ({
      ...row,
      signatures: JSON.parse(String(row.signature_labels_json || "[]")),
    })),
    documents: documents.results,
    page,
    pageSize,
  };
}

export async function secretaryOptions(
  request: Request,
  query: Record<string, unknown>,
) {
  const ctx = await context(request, "SECRETARIA_VISUALIZAR"),
    tenant = ctx.session.user.tenantId,
    term = clean(query.search, 100),
    q = `%${term}%`,
    digits = term.replace(/\D/g, ""),
    scope =
      ctx.session.user.scope === "MATRIZ"
        ? " AND p.matrix_id=?"
        : ctx.session.user.scope === "FILIAL"
          ? " AND p.branch_id=?"
          : "",
    args =
      ctx.session.user.scope === "MATRIZ"
        ? [ctx.session.user.boundMatrixId]
        : ctx.session.user.scope === "FILIAL"
          ? [ctx.session.user.boundBranchId]
          : [];
  const unitsScope = scopeUnit(ctx.session, "u.id");
  const [people, units, functions] = await Promise.all([
    database()
      .prepare(
        `${personSelect} p WHERE tenant_id=?${scope} AND (full_name LIKE ? COLLATE NOCASE OR printf('%06d',member_number) LIKE ? OR cpf LIKE ? OR phone LIKE ?) ORDER BY full_name LIMIT 30`,
      )
      .bind(tenant, ...args, q, q, `%${digits || term}%`, `%${digits || term}%`)
      .all<PersonRow>(),
    database()
      .prepare(
        `SELECT u.id,u.name,u.type,u.parent_id FROM organizational_units u WHERE u.tenant_id=? AND u.status='ATIVO' AND u.archived_at IS NULL AND u.type IN ('MATRIZ','FILIAL') AND ${unitsScope.sql} ORDER BY u.type,u.name LIMIT 100`,
      )
      .bind(tenant, ...unitsScope.args)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT id,name FROM organizational_functions WHERE tenant_id=? AND status='ATIVO' ORDER BY name LIMIT 100",
      )
      .bind(tenant)
      .all<Record<string, unknown>>(),
  ]);
  return {
    people: people.results.map((row) => ({
      ...row,
      member_code: formatMemberCode(row.member_number),
      cpf: row.cpf
        ? `***.***.${row.cpf.slice(-5, -2)}-${row.cpf.slice(-2)}`
        : null,
    })),
    units: units.results,
    functions: functions.results,
  };
}

const actionPermissions: Record<string, PermissionCode> = {
  requestTransfer: "SECRETARIA_TRANSFERENCIAS_SOLICITAR",
  reviewTransfer: "SECRETARIA_TRANSFERENCIAS_APROVAR",
  approveTransfer: "SECRETARIA_TRANSFERENCIAS_APROVAR",
  externalTransfer: "SECRETARIA_MOVIMENTACOES_GERENCIAR",
  movement: "SECRETARIA_MOVIMENTACOES_GERENCIAR",
  receive: "SECRETARIA_RECEBIMENTOS_GERENCIAR",
  createBaptismEvent: "SECRETARIA_BATISMOS_GERENCIAR",
  addBaptismCandidate: "SECRETARIA_BATISMOS_GERENCIAR",
  completeBaptism: "SECRETARIA_BATISMOS_GERENCIAR",
  createConsecration: "SECRETARIA_CONSAGRACOES_GERENCIAR",
  completeConsecration: "SECRETARIA_CONSAGRACOES_GERENCIAR",
  saveTemplate: "SECRETARIA_DOCUMENTOS_MODELOS_GERENCIAR",
  previewDocument: "SECRETARIA_DOCUMENTOS_EMITIR",
  issueDocument: "SECRETARIA_DOCUMENTOS_EMITIR",
};
export async function secretaryOperation(
  request: Request,
  input: Record<string, unknown>,
) {
  const action = String(input.action || ""),
    required = actionPermissions[action];
  if (!required) throw new ApiError(400, "ACAO_INVALIDA", "Ação inválida.");
  const ctx = await context(request, required),
    tenant = ctx.session.user.tenantId,
    stamp = now();
  if (action === "requestTransfer") {
    const personId = id(input.personId),
      requestedDestinationId = id(input.destinationUnitId),
      direction = String(input.direction || "SAIDA").toUpperCase();
    if (!personId || !["SAIDA","RECEBIMENTO"].includes(direction))
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione pessoa e destino.");
    let p:PersonRow, destination:Awaited<ReturnType<typeof tenantUnit>>;
    if(direction==="RECEBIMENTO"){
      const derivedDestinationId=ownDestinationId(ctx.session);
      if(!derivedDestinationId)throw new ApiError(409,"CONTEXTO_INVALIDO","Selecione uma unidade válida antes de solicitar o recebimento.");
      if(ctx.session.user.scope==="FILIAL"&&requestedDestinationId&&requestedDestinationId!==derivedDestinationId)throw new ApiError(403,"DESTINO_BLOQUEADO","O destino do recebimento deve ser sua própria Filial.");
      const scopedDestination=await unit(ctx,ctx.session.user.scope==="FILIAL"?derivedDestinationId:requestedDestinationId??derivedDestinationId);
      destination={...scopedDestination};
      const candidate=await database().prepare(`${personSelect} WHERE id=? AND tenant_id=? AND status NOT IN ('FALECIDO','TRANSFERIDO','DESLIGADO')`).bind(personId,tenant).first<PersonRow>();
      if(!candidate)throw new ApiError(404,"PESSOA_NAO_ENCONTRADA","Pessoa elegível não encontrada.");
      p=candidate;
    }else{
      if(!requestedDestinationId)throw new ApiError(400,"DADOS_INVALIDOS","Selecione a unidade de destino.");
      p=await person(ctx,personId);
      destination=await tenantUnit(ctx,requestedDestinationId);
    }
    const origin = p.branch_id ?? p.matrix_id;
    if (origin === destination.id)
      throw new ApiError(
        409,
        "MESMA_UNIDADE",
        "Esta pessoa já pertence à sua unidade.",
      );
    const pending=await database().prepare("SELECT destination_unit_id FROM secretary_requests WHERE tenant_id=? AND person_id=? AND status IN ('PENDENTE','EM_ANALISE') LIMIT 1").bind(tenant,personId).first<{destination_unit_id:number}>();
    if(pending)throw new ApiError(409,pending.destination_unit_id===destination.id?"SOLICITACAO_DUPLICADA":"TRANSFERENCIA_EM_ANDAMENTO",pending.destination_unit_id===destination.id?"Já existe uma solicitação de transferência pendente para esta pessoa e unidade.":"Esta pessoa já possui outra transferência em andamento.");
    const requestId = generatedId(), recipientsIds = await recipients(ctx, [origin, destination.id]), originUnit=await tenantUnit(ctx,origin), insert=await database().prepare("INSERT INTO secretary_requests(id,tenant_id,person_id,request_type,request_direction,origin_unit_id,destination_unit_id,reason,notes,status,department_resolution,ebd_resolution,requested_by_user_id,requested_at,updated_at) SELECT ?,?,?,'TRANSFERENCIA_INTERNA',?,?,?,?,?,'PENDENTE',?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM secretary_requests WHERE tenant_id=? AND person_id=? AND status IN ('PENDENTE','EM_ANALISE'))").bind(requestId,tenant,personId,direction,origin,destination.id,clean(input.reason,500)||null,clean(input.notes,700)||null,clean(input.departmentResolution,30)||"REVISAR",clean(input.ebdResolution,30)||"REVISAR",ctx.session.user.id,stamp,stamp,tenant,personId).run();
    if(!insert.meta.changes)throw new ApiError(409,"SOLICITACAO_DUPLICADA","Já existe uma solicitação de transferência pendente para esta pessoa.");
    await database().batch([
      audit(
        ctx,
        "TRANSFERENCIA_SOLICITADA",
        "SECRETARY_REQUEST",
        requestId,
        origin,
        null,
        { personId, originId:origin, destinationId:destination.id, direction },
      ),
      ...notify(
        ctx,
        "SECRETARIA_TRANSFERENCIA_PENDENTE",
        direction==="RECEBIMENTO"?"Nova solicitação de recebimento":"Nova transferência aguardando análise",
        direction==="RECEBIMENTO"?`${destination.name} solicitou o recebimento de ${p.full_name}, atualmente vinculado à ${originUnit.name}.`: `${originUnit.name} solicitou a transferência de ${p.full_name} para ${destination.name}.`,
        `/painel/secretaria?aba=transferencias&abrir=${requestId}`,
        "SECRETARY_REQUEST",
        requestId,
        origin,
        recipientsIds,
      ),
    ]);
    return { message: direction==="RECEBIMENTO"?"Solicitação de recebimento enviada para aprovação.":"Transferência solicitada.", id: requestId };
  }
  if (action === "reviewTransfer") {
    const requestId = id(input.requestId),
      version = Number(input.version),
      status = String(input.status);
    if (!requestId || !["EM_ANALISE", "RECUSADA", "CANCELADA"].includes(status))
      throw new ApiError(400, "DADOS_INVALIDOS", "Revisão inválida.");
    const row = await database()
      .prepare(
        "SELECT r.*,p.matrix_id,p.branch_id FROM secretary_requests r JOIN people p ON p.id=r.person_id AND p.tenant_id=r.tenant_id WHERE r.id=? AND r.tenant_id=?",
      )
      .bind(requestId, tenant)
      .first<Record<string, unknown>>();
    if (!row || !personInScope(ctx.session, row as unknown as PersonRow))
      throw new ApiError(
        404,
        "SOLICITACAO_NAO_ENCONTRADA",
        "Solicitação não encontrada.",
      );
    if (
      Number(row.version) !== version ||
      !["PENDENTE", "EM_ANALISE"].includes(String(row.status))
    )
      throw new ApiError(
        409,
        "SOLICITACAO_ATUALIZADA",
        "A solicitação já foi atualizada por outra pessoa.",
      );
    const result = await database()
      .prepare(
        "UPDATE secretary_requests SET status=?,version=version+1,reviewed_by_user_id=?,reviewed_at=?,updated_at=? WHERE id=? AND tenant_id=? AND version=? AND status IN ('PENDENTE','EM_ANALISE')",
      )
      .bind(
        status,
        ctx.session.user.id,
        stamp,
        stamp,
        requestId,
        tenant,
        version,
      )
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        "SOLICITACAO_ATUALIZADA",
        "A solicitação já foi atualizada.",
      );
    await database().batch([
      audit(
        ctx,
        `TRANSFERENCIA_${status}`,
        "SECRETARY_REQUEST",
        requestId,
        Number(row.origin_unit_id),
        row,
        { status },
        clean(input.reason, 500) || null,
      ),
    ]);
    return {
      message:
        status === "RECUSADA"
          ? "Transferência recusada."
          : status === "CANCELADA"
            ? "Transferência cancelada."
            : "Transferência em análise.",
    };
  }
  if (action === "approveTransfer") {
    const requestId = id(input.requestId),
      version = Number(input.version);
    if (!requestId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a solicitação.");
    const row = await database()
      .prepare(
        "SELECT r.*,p.full_name,p.status person_status,p.matrix_id,p.branch_id FROM secretary_requests r JOIN people p ON p.id=r.person_id AND p.tenant_id=r.tenant_id WHERE r.id=? AND r.tenant_id=?",
      )
      .bind(requestId, tenant)
      .first<Record<string, unknown>>();
    if (
      !row ||
      !personInScope(ctx.session, {
        ...row,
        id: Number(row.person_id),
        tenant_id: tenant,
        member_number: 0,
        full_name: String(row.full_name),
        status: String(row.person_status),
        birth_date: null,
        cpf: null,
        rg: null,
        phone: null,
        whatsapp: null,
        matrix_id: Number(row.matrix_id),
        branch_id: row.branch_id ? Number(row.branch_id) : null,
        primary_function_id: null,
        baptism_date: null,
        consecration_date: null,
      })
    )
      throw new ApiError(
        404,
        "SOLICITACAO_NAO_ENCONTRADA",
        "Solicitação não encontrada.",
      );
    if (
      Number(row.version) !== version ||
      !["PENDENTE", "EM_ANALISE"].includes(String(row.status))
    )
      throw new ApiError(
        409,
        "SOLICITACAO_ATUALIZADA",
        "A solicitação já foi analisada.",
      );
    const destination = await tenantUnit(ctx, Number(row.destination_unit_id)),
      movementId = generatedId(),
      effective = date(input.effectiveDate || stamp.slice(0, 10)),
      departments = Number(
        (
          await database()
            .prepare(
              "SELECT COUNT(*) total FROM department_participants dp JOIN departments d ON d.id=dp.department_id AND d.tenant_id=dp.tenant_id WHERE dp.person_id=? AND dp.tenant_id=? AND dp.status='ATIVO' AND d.unit_id<>?",
            )
            .bind(row.person_id, tenant, destination.id)
            .first<{ total: number }>()
        )?.total || 0,
      ),
      ebd = Number(
        (
          await database()
            .prepare(
              "SELECT COUNT(*) total FROM ebd_students s WHERE s.person_id=? AND s.tenant_id=? AND s.status='ATIVO' AND EXISTS(SELECT 1 FROM departments d WHERE d.id=s.department_id AND d.unit_id<>?)",
            )
            .bind(row.person_id, tenant, destination.id)
            .first<{ total: number }>()
        )?.total || 0,
      ),
      notificationUsers = await recipients(ctx, [
        Number(row.origin_unit_id),
        destination.id,
      ]);
    const update = database()
      .prepare(
        "UPDATE secretary_requests SET status='CONCLUIDA',version=version+1,reviewed_by_user_id=?,reviewed_at=?,completed_at=?,updated_at=? WHERE id=? AND tenant_id=? AND version=? AND status IN ('PENDENTE','EM_ANALISE')",
      )
      .bind(
        ctx.session.user.id,
        stamp,
        stamp,
        stamp,
        requestId,
        tenant,
        version,
      );
    const relationshipUpdates = [];
    if (row.department_resolution === "ENCERRAR")
      relationshipUpdates.push(
        database()
          .prepare(
            "UPDATE department_participants SET status='INATIVO',left_at=?,exit_reason='TRANSFERENCIA_INTERNA',updated_at=? WHERE tenant_id=? AND person_id=? AND status='ATIVO' AND EXISTS(SELECT 1 FROM departments d WHERE d.id=department_participants.department_id AND d.tenant_id=department_participants.tenant_id AND d.unit_id<>?)",
          )
          .bind(effective, stamp, tenant, row.person_id, destination.id),
      );
    if (row.ebd_resolution === "ENCERRAR")
      relationshipUpdates.push(
        database()
          .prepare(
            "UPDATE ebd_student_enrollments SET status='INATIVO',left_at=?,updated_at=? WHERE tenant_id=? AND status='ATIVO' AND student_id IN(SELECT s.id FROM ebd_students s JOIN departments d ON d.id=s.department_id AND d.tenant_id=s.tenant_id WHERE s.tenant_id=? AND s.person_id=? AND d.unit_id<>?)",
          )
          .bind(
            effective,
            stamp,
            tenant,
            tenant,
            row.person_id,
            destination.id,
          ),
      );
    await database().batch([
      update,
      ...relationshipUpdates,
      database()
        .prepare(
          "UPDATE people SET matrix_id=?,branch_id=?,updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(
          destination.matrixId,
          destination.branchId,
          stamp,
          row.person_id,
          tenant,
        ),
      database()
        .prepare(
          "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,request_id,effective_date,previous_status,new_status,previous_unit_id,destination_unit_id,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,?,?,?,'TRANSFERENCIA_INTERNA',?,?,?,?,?,?,?,?,'CONCLUIDA',?,?)",
        )
        .bind(
          movementId,
          tenant,
          row.person_id,
          destination.id,
          requestId,
          effective,
          row.person_status,
          row.person_status,
          row.origin_unit_id,
          destination.id,
          `Transferência interna concluída para ${destination.name}.`,
          JSON.stringify({
            departmentsForReview: departments,
            ebdForReview: ebd,
            departmentResolution: row.department_resolution,
            ebdResolution: row.ebd_resolution,
          }),
          ctx.session.user.id,
          stamp,
        ),
      history(
        ctx,
        Number(row.person_id),
        "TRANSFERENCIA_INTERNA",
        `Transferido para ${destination.name}.`,
        effective,
        { unitId: row.origin_unit_id },
        { unitId: destination.id },
      ),
      audit(
        ctx,
        "TRANSFERENCIA_APROVADA",
        "SECRETARY_REQUEST",
        requestId,
        destination.id,
        row,
        { destinationId: destination.id, departments, ebd },
      ),
      ...notify(
        ctx,
        "SECRETARIA_TRANSFERENCIA_CONCLUIDA",
        "Transferência interna concluída",
        "Uma transferência interna foi concluída e os vínculos relacionados estão disponíveis para revisão.",
        `/painel/secretaria?aba=historico&abrir=${requestId}`,
        "SECRETARY_REQUEST",
        requestId,
        destination.id,
        notificationUsers,
      ),
    ]);
    return {
      message: `Transferência concluída. ${departments} vínculo(s) departamental(is) e ${ebd} matrícula(s) da EBD sinalizados para revisão.`,
    };
  }
  if (action === "externalTransfer") {
    const personId = id(input.personId);
    if (!personId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a pessoa.");
    const p = await person(ctx, personId),
      effective = date(input.effectiveDate),
      church = clean(input.externalChurch, 180);
    if (!church)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Informe a igreja de destino.",
      );
    const movementId = generatedId(),
      unitId = p.branch_id ?? p.matrix_id;
    await database().batch([
      database()
        .prepare(
          "UPDATE people SET status='TRANSFERIDO',updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(stamp, personId, tenant),
      database()
        .prepare(
          "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,effective_date,previous_status,new_status,previous_unit_id,external_church,external_city,external_state,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,?,?,?,'TRANSFERENCIA_EXTERNA',?,?,?,?,?,?,?,?,?,'CONCLUIDA',?,?)",
        )
        .bind(
          movementId,
          tenant,
          personId,
          unitId,
          effective,
          p.status,
          "TRANSFERIDO",
          unitId,
          church,
          clean(input.externalCity, 100) || null,
          clean(input.externalState, 2) || null,
          `Transferido para ${church}.`,
          JSON.stringify({ notes: clean(input.notes, 700) }),
          ctx.session.user.id,
          stamp,
        ),
      history(
        ctx,
        personId,
        "TRANSFERENCIA_EXTERNA",
        `Transferido para ${church}.`,
        effective,
        { status: p.status },
        { status: "TRANSFERIDO" },
      ),
      audit(ctx, "TRANSFERENCIA_EXTERNA", "PERSON", personId, unitId, p, {
        church,
      }),
    ]);
    return {
      message: "Transferência externa registrada sem excluir a Pessoa.",
    };
  }
  if (action === "receive") {
    const personId = id(input.personId);
    if (!personId)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Pesquise ou cadastre a Pessoa antes do recebimento.",
      );
    const p = await person(ctx, personId),
      effective = date(input.effectiveDate),
      origin = clean(input.originChurch, 180);
    if (!origin)
      throw new ApiError(400, "DADOS_INVALIDOS", "Informe a igreja de origem.");
    const movementId = generatedId(),
      unitId = p.branch_id ?? p.matrix_id;
    await database().batch([
      database()
        .prepare(
          "UPDATE people SET status='MEMBRO_ATIVO',church_entry_date=COALESCE(church_entry_date,?),origin_church=COALESCE(origin_church,?),updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(effective, origin, stamp, personId, tenant),
      database()
        .prepare(
          "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,effective_date,previous_status,new_status,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,?,?,?,'RECEBIMENTO',?,?,? ,?,?,'CONCLUIDA',?,?)",
        )
        .bind(
          movementId,
          tenant,
          personId,
          unitId,
          effective,
          p.status,
          "MEMBRO_ATIVO",
          `Recebido de ${origin}.`,
          JSON.stringify({
            city: clean(input.originCity, 100),
            state: clean(input.originState, 2),
            kind: clean(input.receiptType, 50),
            notes: clean(input.notes, 700),
          }),
          ctx.session.user.id,
          stamp,
        ),
      history(
        ctx,
        personId,
        "RECEBIMENTO",
        `Recebido de ${origin}.`,
        effective,
        { status: p.status },
        { status: "MEMBRO_ATIVO" },
      ),
      audit(ctx, "MEMBRO_RECEBIDO", "PERSON", personId, unitId, p, { origin }),
    ]);
    return { message: "Recebimento registrado." };
  }
  if (action === "movement") {
    const personId = id(input.personId),
      type = String(input.movementType),
      allowed = [
        "AFASTAMENTO",
        "RETORNO",
        "DESLIGAMENTO",
        "FALECIMENTO",
        "OUTRO",
      ];
    if (!personId || !allowed.includes(type))
      throw new ApiError(400, "DADOS_INVALIDOS", "Movimentação inválida.");
    const p = await person(ctx, personId),
      effective = date(input.effectiveDate),
      status =
        type === "AFASTAMENTO"
          ? "AFASTADO"
          : type === "RETORNO"
            ? "MEMBRO_ATIVO"
            : type === "DESLIGAMENTO"
              ? "DESLIGADO"
              : type === "FALECIMENTO"
                ? "FALECIDO"
                : p.status,
      description =
        clean(input.description, 500) ||
        (
          {
            AFASTAMENTO: "Afastamento registrado.",
            RETORNO: "Retorno à comunhão registrado.",
            DESLIGAMENTO: "Desligamento registrado.",
            FALECIMENTO: "Falecimento registrado.",
            OUTRO: "Movimentação eclesiástica registrada.",
          } as Record<string, string>
        )[type],
      movementId = generatedId(),
      unitId = p.branch_id ?? p.matrix_id;
    await database().batch([
      database()
        .prepare(
          "UPDATE people SET status=?,updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(status, stamp, personId, tenant),
      database()
        .prepare(
          "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,effective_date,previous_status,new_status,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,'CONCLUIDA',?,?)",
        )
        .bind(
          movementId,
          tenant,
          personId,
          unitId,
          type,
          effective,
          p.status,
          status,
          description,
          JSON.stringify({
            reason: clean(input.reason, 300),
            notes: clean(input.notes, 700),
          }),
          ctx.session.user.id,
          stamp,
        ),
      history(
        ctx,
        personId,
        type,
        description,
        effective,
        { status: p.status },
        { status },
      ),
      audit(
        ctx,
        type,
        "PERSON",
        personId,
        unitId,
        p,
        { status },
        clean(input.reason, 300) || null,
      ),
    ]);
    return { message: "Movimentação registrada no histórico eclesiástico." };
  }
  if (action === "createBaptismEvent") {
    const unitId = id(input.unitId);
    if (!unitId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a unidade.");
    await unit(ctx, unitId);
    const eventId = generatedId(),
      scheduled = date(input.scheduledDate),
      title =
        clean(input.title, 180) ||
        `Batismo — ${scheduled.split("-").reverse().join("/")}`;
    await database().batch([
      database()
        .prepare(
          "INSERT INTO baptism_events(id,tenant_id,unit_id,title,scheduled_date,location,responsible_person_id,notes,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?, 'AGENDADO',?,?,?)",
        )
        .bind(
          eventId,
          tenant,
          unitId,
          title,
          scheduled,
          clean(input.location, 180) || null,
          id(input.responsiblePersonId),
          clean(input.notes, 700) || null,
          ctx.session.user.id,
          stamp,
          stamp,
        ),
      audit(ctx, "BATISMO_AGENDADO", "BAPTISM_EVENT", eventId, unitId, null, {
        title,
        scheduled,
      }),
    ]);
    return { message: "Evento de batismo criado.", id: eventId };
  }
  if (action === "addBaptismCandidate") {
    const eventId = id(input.eventId),
      personId = id(input.personId);
    if (!eventId || !personId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione evento e pessoa.");
    const p = await person(ctx, personId),
      event = await database()
        .prepare(
          "SELECT id,unit_id FROM baptism_events WHERE id=? AND tenant_id=?",
        )
        .bind(eventId, tenant)
        .first<{ id: number; unit_id: number }>();
    if (!event)
      throw new ApiError(
        404,
        "EVENTO_NAO_ENCONTRADO",
        "Evento não encontrado.",
      );
    await database().batch([
      database()
        .prepare(
          "INSERT INTO baptism_candidates(event_id,tenant_id,person_id,status,notes,updated_by_user_id,created_at,updated_at) VALUES(?,?,?,'CANDIDATO',?,?,?,?) ON CONFLICT(event_id,person_id) DO UPDATE SET status='CANDIDATO',notes=excluded.notes,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at",
        )
        .bind(
          eventId,
          tenant,
          personId,
          clean(input.notes, 500) || null,
          ctx.session.user.id,
          stamp,
          stamp,
        ),
      audit(
        ctx,
        "CANDIDATO_BATISMO_ADICIONADO",
        "BAPTISM_EVENT",
        eventId,
        event.unit_id,
        null,
        { personId: p.id },
      ),
    ]);
    return { message: "Candidato adicionado." };
  }
  if (action === "completeBaptism") {
    const eventId = id(input.eventId),
      personId = id(input.personId);
    if (!eventId || !personId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione evento e pessoa.");
    const p = await person(ctx, personId),
      event = await database()
        .prepare(
          "SELECT id,unit_id,scheduled_date FROM baptism_events WHERE id=? AND tenant_id=?",
        )
        .bind(eventId, tenant)
        .first<{ id: number; unit_id: number; scheduled_date: string }>();
    if (!event)
      throw new ApiError(
        404,
        "EVENTO_NAO_ENCONTRADO",
        "Evento não encontrado.",
      );
    if (p.baptism_date && input.confirmOverwrite !== true)
      throw new ApiError(
        409,
        "BATISMO_JA_INFORMADO",
        `A ficha já possui data de batismo (${p.baptism_date}). Confirme para substituir.`,
      );
    const movementId = generatedId();
    await database().batch([
      database()
        .prepare(
          "UPDATE baptism_candidates SET status='REALIZADO',completed_at=?,updated_by_user_id=?,updated_at=? WHERE event_id=? AND person_id=? AND tenant_id=?",
        )
        .bind(stamp, ctx.session.user.id, stamp, eventId, personId, tenant),
      database()
        .prepare(
          "UPDATE people SET baptism_date=?,updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(event.scheduled_date, stamp, personId, tenant),
      database()
        .prepare(
          "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,effective_date,previous_status,new_status,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,?,?,?,'BATISMO',?,?,?,?,?,'CONCLUIDA',?,?)",
        )
        .bind(
          movementId,
          tenant,
          personId,
          event.unit_id,
          event.scheduled_date,
          p.status,
          p.status,
          "Batismo realizado.",
          JSON.stringify({ eventId, previousBaptismDate: p.baptism_date }),
          ctx.session.user.id,
          stamp,
        ),
      history(
        ctx,
        personId,
        "BATISMO",
        "Batismo realizado.",
        event.scheduled_date,
        { baptismDate: p.baptism_date },
        { baptismDate: event.scheduled_date },
      ),
      audit(
        ctx,
        "BATISMO_REALIZADO",
        "BAPTISM_EVENT",
        eventId,
        event.unit_id,
        { personId, baptismDate: p.baptism_date },
        { personId, baptismDate: event.scheduled_date },
      ),
    ]);
    return { message: "Batismo concluído e ficha atualizada." };
  }
  if (action === "createConsecration") {
    const personId = id(input.personId),
      functionId = id(input.newFunctionId),
      unitId = id(input.unitId);
    if (!personId || !functionId || !unitId)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Selecione pessoa, unidade e nova função.",
      );
    const p = await person(ctx, personId);
    await unit(ctx, unitId);
    const fn = await database()
      .prepare(
        "SELECT id FROM organizational_functions WHERE id=? AND tenant_id=? AND status='ATIVO'",
      )
      .bind(functionId, tenant)
      .first();
    if (!fn)
      throw new ApiError(
        404,
        "FUNCAO_NAO_ENCONTRADA",
        "Função não encontrada.",
      );
    const consecrationId = generatedId(),
      eventDate = date(input.eventDate);
    await database().batch([
      database()
        .prepare(
          "INSERT INTO consecrations(id,tenant_id,person_id,unit_id,previous_function_id,new_function_id,event_date,location,responsible_person_id,notes,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'SOLICITADA',?,?,?)",
        )
        .bind(
          consecrationId,
          tenant,
          personId,
          unitId,
          p.primary_function_id,
          functionId,
          eventDate,
          clean(input.location, 180) || null,
          id(input.responsiblePersonId),
          clean(input.notes, 700) || null,
          ctx.session.user.id,
          stamp,
          stamp,
        ),
      audit(
        ctx,
        "CONSAGRACAO_SOLICITADA",
        "CONSECRATION",
        consecrationId,
        unitId,
        null,
        { personId, functionId, eventDate },
      ),
    ]);
    return { message: "Consagração registrada.", id: consecrationId };
  }
  if (action === "completeConsecration") {
    const consecrationId = id(input.consecrationId),
      version = Number(input.version);
    const row = consecrationId
      ? await database()
          .prepare(
            "SELECT c.*,p.matrix_id,p.branch_id,p.full_name FROM consecrations c JOIN people p ON p.id=c.person_id AND p.tenant_id=c.tenant_id WHERE c.id=? AND c.tenant_id=?",
          )
          .bind(consecrationId, tenant)
          .first<Record<string, unknown>>()
      : null;
    if (
      !row ||
      !personInScope(ctx.session, {
        ...row,
        id: Number(row.person_id),
        tenant_id: tenant,
        member_number: 0,
        status: "",
        birth_date: null,
        cpf: null,
        rg: null,
        phone: null,
        whatsapp: null,
        primary_function_id: row.previous_function_id
          ? Number(row.previous_function_id)
          : null,
        baptism_date: null,
        consecration_date: null,
      } as PersonRow)
    )
      throw new ApiError(
        404,
        "CONSAGRACAO_NAO_ENCONTRADA",
        "Consagração não encontrada.",
      );
    if (Number(row.version) !== version || row.status === "REALIZADA")
      throw new ApiError(
        409,
        "REGISTRO_ATUALIZADO",
        "A consagração já foi atualizada.",
      );
    const result = await database()
      .prepare(
        "UPDATE consecrations SET status='REALIZADA',version=version+1,completed_by_user_id=?,updated_at=? WHERE id=? AND tenant_id=? AND version=? AND status<>'REALIZADA'",
      )
      .bind(ctx.session.user.id, stamp, consecrationId, tenant, version)
      .run();
    if (!result.meta.changes)
      throw new ApiError(
        409,
        "REGISTRO_ATUALIZADO",
        "A consagração já foi atualizada.",
      );
    const movementId = generatedId();
    await database().batch([
      database()
        .prepare(
          "UPDATE people SET primary_function_id=?,consecration_date=?,updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(
          row.new_function_id,
          row.event_date,
          stamp,
          row.person_id,
          tenant,
        ),
      database()
        .prepare(
          "INSERT INTO person_functions(person_id,tenant_id,function_id,is_primary,started_at,created_at) VALUES(?,?,?,1,?,?) ON CONFLICT(person_id,function_id) DO UPDATE SET is_primary=1,ended_at=NULL",
        )
        .bind(
          row.person_id,
          tenant,
          row.new_function_id,
          row.event_date,
          stamp,
        ),
      database()
        .prepare(
          "UPDATE person_functions SET is_primary=0,ended_at=CASE WHEN function_id=? THEN ? ELSE ended_at END WHERE person_id=? AND tenant_id=? AND function_id<>?",
        )
        .bind(
          row.previous_function_id,
          row.event_date,
          row.person_id,
          tenant,
          row.new_function_id,
        ),
      database()
        .prepare(
          "INSERT INTO church_movements(id,tenant_id,person_id,unit_id,movement_type,effective_date,previous_status,new_status,description,metadata_json,status,created_by_user_id,created_at) VALUES(?,?,?,?,'CONSAGRACAO',?,?,?,?,?,'CONCLUIDA',?,?)",
        )
        .bind(
          movementId,
          tenant,
          row.person_id,
          row.unit_id,
          row.event_date,
          "",
          "",
          "Consagração realizada.",
          JSON.stringify({
            previousFunctionId: row.previous_function_id,
            newFunctionId: row.new_function_id,
          }),
          ctx.session.user.id,
          stamp,
        ),
      history(
        ctx,
        Number(row.person_id),
        "CONSAGRACAO",
        "Consagração ministerial realizada.",
        String(row.event_date),
        { functionId: row.previous_function_id },
        { functionId: row.new_function_id },
      ),
      audit(
        ctx,
        "CONSAGRACAO_REALIZADA",
        "CONSECRATION",
        Number(row.id),
        Number(row.unit_id),
        row,
        { status: "REALIZADA" },
      ),
    ]);
    return { message: "Consagração concluída e função atualizada." };
  }
  if (action === "saveTemplate") {
    const templateId = id(input.templateId),
      name = clean(input.name, 140),
      documentType = clean(input.documentType, 60),
      title = templateText(input.title, 180),
      body = templateText(input.body, 5000),
      header = templateText(input.headerText, 500),
      footer = templateText(input.footerText, 500),
      signatures = Array.isArray(input.signatures)
        ? input.signatures
            .map((v) => clean(v, 80))
            .filter(Boolean)
            .slice(0, 4)
        : [];
    if (!name || !documentType || !title || !body)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Informe nome, tipo, título e texto do modelo.",
      );
    if (templateId) {
      const current = await database()
        .prepare(
          "SELECT * FROM secretary_document_templates WHERE id=? AND tenant_id=?",
        )
        .bind(templateId, tenant)
        .first<Record<string, unknown>>();
      if (!current)
        throw new ApiError(
          404,
          "MODELO_NAO_ENCONTRADO",
          "Modelo não encontrado.",
        );
      const nextVersion = Number(current.current_version) + 1;
      await database().batch([
        database()
          .prepare(
            "UPDATE secretary_document_templates SET name=?,document_type=?,current_version=?,updated_at=? WHERE id=? AND tenant_id=?",
          )
          .bind(name, documentType, nextVersion, stamp, templateId, tenant),
        database()
          .prepare(
            "INSERT INTO secretary_document_template_versions(template_id,tenant_id,version,title,body,header_text,footer_text,signature_labels_json,style_json,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            templateId,
            tenant,
            nextVersion,
            title,
            body,
            header || null,
            footer || null,
            JSON.stringify(signatures),
            JSON.stringify({
              align: clean(input.align, 10) || "left",
              fontSize: Math.min(
                18,
                Math.max(10, Number(input.fontSize) || 12),
              ),
              margin: Math.min(35, Math.max(10, Number(input.margin) || 20)),
            }),
            ctx.session.user.id,
            stamp,
          ),
        audit(
          ctx,
          "MODELO_DOCUMENTO_ALTERADO",
          "DOCUMENT_TEMPLATE",
          templateId,
          id(input.unitId),
          current,
          { version: nextVersion },
        ),
      ]);
      return { message: `Modelo salvo como versão ${nextVersion}.` };
    }
    const newId = generatedId();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO secretary_document_templates(id,tenant_id,unit_id,name,document_type,status,current_version,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,'ATIVO',1,?,?,?)",
        )
        .bind(
          newId,
          tenant,
          id(input.unitId),
          name,
          documentType,
          ctx.session.user.id,
          stamp,
          stamp,
        ),
      database()
        .prepare(
          "INSERT INTO secretary_document_template_versions(template_id,tenant_id,version,title,body,header_text,footer_text,signature_labels_json,style_json,created_by_user_id,created_at) VALUES(?,?,1,?,?,?,?,?,?,?,?)",
        )
        .bind(
          newId,
          tenant,
          title,
          body,
          header || null,
          footer || null,
          JSON.stringify(signatures),
          JSON.stringify({
            align: clean(input.align, 10) || "left",
            fontSize: Math.min(18, Math.max(10, Number(input.fontSize) || 12)),
            margin: Math.min(35, Math.max(10, Number(input.margin) || 20)),
          }),
          ctx.session.user.id,
          stamp,
        ),
      audit(
        ctx,
        "MODELO_DOCUMENTO_CRIADO",
        "DOCUMENT_TEMPLATE",
        newId,
        id(input.unitId),
        null,
        { name, documentType },
      ),
    ]);
    return { message: "Modelo criado.", id: newId };
  }
  if (action === "previewDocument" || action === "issueDocument") {
    const personId = id(input.personId),
      templateId = id(input.templateId);
    if (!personId || !templateId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione pessoa e modelo.");
    const p = await person(ctx, personId),
      template = await database()
        .prepare(
          "SELECT t.*,v.title,v.body,v.header_text,v.footer_text,v.signature_labels_json,v.style_json FROM secretary_document_templates t JOIN secretary_document_template_versions v ON v.template_id=t.id AND v.version=t.current_version WHERE t.id=? AND t.tenant_id=? AND t.status='ATIVO'",
        )
        .bind(templateId, tenant)
        .first<Record<string, unknown>>();
    if (!template)
      throw new ApiError(
        404,
        "MODELO_NAO_ENCONTRADO",
        "Modelo não encontrado.",
      );
    const resolved = await resolveDocument(ctx, p, template);
    if (action === "previewDocument")
      return { preview: resolved, warnings: resolved.warnings };
    const unitId = p.branch_id ?? p.matrix_id,
      year = new Date().getUTCFullYear(),
      sequence = await database()
        .prepare(
          "INSERT INTO secretary_document_sequences(tenant_id,year,last_number,updated_at) VALUES(?,?,1,?) ON CONFLICT(tenant_id,year) DO UPDATE SET last_number=last_number+1,updated_at=excluded.updated_at RETURNING last_number",
        )
        .bind(tenant, year, stamp)
        .first<{ last_number: number }>(),
      prefix =
        String(template.document_type || "DOC")
          .replace(/[^A-Z]/gi, "")
          .toUpperCase()
          .slice(0, 5) || "DOC",
      number = `${prefix}-${year}-${String(sequence!.last_number).padStart(6, "0")}`,
      documentId = generatedId();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO secretary_documents(id,tenant_id,unit_id,person_id,template_id,template_version,document_type,document_number,title_snapshot,body_snapshot,header_snapshot,footer_snapshot,signatures_snapshot,issued_by_user_id,issued_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          documentId,
          tenant,
          unitId,
          personId,
          templateId,
          template.current_version,
          template.document_type,
          number,
          resolved.title,
          resolved.body,
          resolved.header || null,
          resolved.footer || null,
          JSON.stringify(resolved.signatures),
          ctx.session.user.id,
          stamp,
        ),
      audit(
        ctx,
        "DOCUMENTO_EMITIDO",
        "SECRETARY_DOCUMENT",
        documentId,
        unitId,
        null,
        { number, personId, templateId, version: template.current_version },
      ),
    ]);
    return {
      message: `Documento ${number} emitido.`,
      documentId,
      documentNumber: number,
      preview: resolved,
    };
  }
  throw new ApiError(400, "ACAO_INVALIDA", "Ação inválida.");
}

const allowedVariables = new Set([
  "nome_membro",
  "codigo_membro",
  "cpf",
  "rg",
  "data_nascimento",
  "funcao",
  "matriz",
  "filial",
  "nome_igreja",
  "cidade",
  "data_atual",
  "data_batismo",
]);
function templateText(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  if (/[<>]/.test(text))
    throw new ApiError(
      400,
      "MODELO_INSEGURO",
      "O modelo aceita somente texto e variáveis seguras, sem HTML.",
    );
  for (const match of text.matchAll(/\{([^}]+)\}/g))
    if (!allowedVariables.has(match[1]))
      throw new ApiError(
        400,
        "VARIAVEL_INVALIDA",
        `Variável não permitida: {${match[1]}}.`,
      );
  return text;
}
async function resolveDocument(
  ctx: Ctx,
  p: PersonRow,
  template: Record<string, unknown>,
) {
  const unitId = p.branch_id ?? p.matrix_id,
    unitRow = await database()
      .prepare(
        "SELECT u.name,u.city,m.name matrix_name,b.name branch_name,f.name function_name FROM organizational_units u LEFT JOIN organizational_units m ON m.id=? AND m.tenant_id=u.tenant_id LEFT JOIN organizational_units b ON b.id=? AND b.tenant_id=u.tenant_id LEFT JOIN organizational_functions f ON f.id=? AND f.tenant_id=u.tenant_id WHERE u.id=? AND u.tenant_id=?",
      )
      .bind(
        p.matrix_id,
        p.branch_id,
        p.primary_function_id,
        unitId,
        ctx.session.user.tenantId,
      )
      .first<Record<string, unknown>>(),
    values: Record<string, string | null> = {
      nome_membro: p.full_name,
      codigo_membro: formatMemberCode(p.member_number),
      cpf: p.cpf,
      rg: p.rg,
      data_nascimento: p.birth_date,
      funcao: String(unitRow?.function_name || "") || null,
      matriz: String(unitRow?.matrix_name || "") || null,
      filial: String(unitRow?.branch_name || "") || null,
      nome_igreja: String(unitRow?.name || "") || null,
      cidade: String(unitRow?.city || "") || null,
      data_atual: new Date().toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }),
      data_batismo: p.baptism_date,
    },
    warnings: string[] = [];
  const replace = (text: unknown) =>
    String(text || "").replace(/\{([^}]+)\}/g, (_, key: string) => {
      if (!values[key])
        warnings.push(`${key.replaceAll("_", " ")} não informado.`);
      return values[key] || "________________";
    });
  return {
    title: replace(template.title),
    body: replace(template.body),
    header: replace(template.header_text),
    footer: replace(template.footer_text),
    signatures: JSON.parse(String(template.signature_labels_json || "[]")),
    style: JSON.parse(String(template.style_json || "{}")),
    warnings: [...new Set(warnings)],
  };
}

export async function secretaryReport(
  request: Request,
  query: Record<string, unknown>,
) {
  const ctx = await context(request, "SECRETARIA_RELATORIOS"),
    tenant = ctx.session.user.tenantId,
    from = clean(query.from, 10) || "0000-01-01",
    to = clean(query.to, 10) || "9999-12-31",
    type = clean(query.type, 60),
    scope = scopeUnit(ctx.session, "m.unit_id"),
    where = ["m.tenant_id=?", "m.effective_date BETWEEN ? AND ?", scope.sql],
    args: unknown[] = [tenant, from, to, ...scope.args];
  if (type) {
    where.push("m.movement_type=?");
    args.push(type);
  }
  const movements = await database()
      .prepare(
        `SELECT m.movement_type,m.effective_date,m.description,m.status,p.full_name,p.member_number,u.name unit_name FROM church_movements m JOIN people p ON p.id=m.person_id AND p.tenant_id=m.tenant_id JOIN organizational_units u ON u.id=m.unit_id AND u.tenant_id=m.tenant_id WHERE ${where.join(" AND ")} ORDER BY m.effective_date DESC LIMIT 1000`,
      )
      .bind(...args)
      .all<Record<string, unknown>>(),
    documents = await database()
      .prepare(
        `SELECT d.document_number,d.document_type,d.issued_at,p.full_name,u.name unit_name FROM secretary_documents d JOIN people p ON p.id=d.person_id AND p.tenant_id=d.tenant_id JOIN organizational_units u ON u.id=d.unit_id AND u.tenant_id=d.tenant_id WHERE d.tenant_id=? AND d.issued_at BETWEEN ? AND ? AND ${scopeUnit(ctx.session, "d.unit_id").sql} ORDER BY d.issued_at DESC LIMIT 1000`,
      )
      .bind(
        tenant,
        `${from}T00:00:00`,
        `${to}T23:59:59`,
        ...scopeUnit(ctx.session, "d.unit_id").args,
      )
      .all<Record<string, unknown>>();
  return { movements: movements.results, documents: documents.results };
}

export async function secretaryDocument(request: Request, documentId: number) {
  const ctx = await context(request, "SECRETARIA_DOCUMENTOS_EMITIR"),
    scope = scopeUnit(ctx.session, "d.unit_id"),
    row = await database()
      .prepare(
        `SELECT d.*,p.full_name,u.name unit_name FROM secretary_documents d JOIN people p ON p.id=d.person_id AND p.tenant_id=d.tenant_id JOIN organizational_units u ON u.id=d.unit_id AND u.tenant_id=d.tenant_id WHERE d.id=? AND d.tenant_id=? AND ${scope.sql}`,
      )
      .bind(documentId, ctx.session.user.tenantId, ...scope.args)
      .first<Record<string, unknown>>();
  if (!row)
    throw new ApiError(
      404,
      "DOCUMENTO_NAO_ENCONTRADO",
      "Documento não encontrado.",
    );
  return {
    ...row,
    signatures: JSON.parse(String(row.signatures_snapshot || "[]")),
  };
}

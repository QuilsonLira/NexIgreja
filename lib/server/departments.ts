import { ApiError, database } from "@/lib/server/auth";
import {
  generatedId,
  requireAnyPermission,
  requirePermission,
} from "@/lib/server/admin";
import type { PermissionCode } from "@/lib/admin/permissions";
import {
  DEPARTMENT_LOCAL_PERMISSIONS,
  type DepartmentLocalPermission,
  type DepartmentRecord,
  type DepartmentType,
} from "@/lib/departments/types";
import {
  consecutiveAbsences,
  departmentWithinOrganizationalScope,
} from "@/lib/departments/policy";

const now = () => new Date().toISOString();
const clean = (value: unknown, max = 240) =>
  typeof value === "string"
    ? value.trim().replace(/[<>]/g, "").slice(0, max)
    : "";
const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const jsonArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === "string").slice(0, 60)
    : [];
const statusValue = (value: unknown) =>
  value === "INATIVO" ? "INATIVO" : "ATIVO";
const departmentTypes = new Set<DepartmentType>([
  "DEPARTAMENTO",
  "MINISTERIO",
  "GRUPO",
  "EQUIPE",
  "ESCOLA_BIBLICA",
  "OUTRO",
]);
type DepartmentRow = {
  id: number;
  tenant_id: number;
  name: string;
  acronym: string | null;
  description: string | null;
  type: DepartmentType;
  unit_id: number;
  unit_name: string;
  convention_id: number;
  matrix_id: number | null;
  branch_id: number | null;
  status: "ATIVO" | "INATIVO";
  enabled_features: string;
  absence_alert_threshold: number;
  version: number;
  participant_count: number;
  class_count: number;
  next_event: string | null;
  average_attendance: number | null;
  local_permissions: string | null;
};
type DepartmentContext = {
  session: Awaited<ReturnType<typeof requirePermission>>["session"];
  permissions: Set<PermissionCode>;
  department: DepartmentRow;
  localPermissions: Set<string>;
  admin: boolean;
};

function personBelongsToDepartmentUnit(
  department: DepartmentRow,
  person: Record<string, unknown>,
) {
  return department.branch_id
    ? Number(person.branch_id) === department.branch_id
    : Number(person.matrix_id) === department.matrix_id;
}

function mapDepartment(row: DepartmentRow, admin: boolean): DepartmentRecord {
  return {
    id: row.id,
    name: row.name,
    acronym: row.acronym,
    description: row.description,
    type: row.type,
    unitId: row.unit_id,
    unitName: row.unit_name,
    conventionId: row.convention_id,
    matrixId: row.matrix_id,
    branchId: row.branch_id,
    status: row.status,
    enabledFeatures: JSON.parse(row.enabled_features || "[]"),
    absenceAlertThreshold: row.absence_alert_threshold,
    version: row.version,
    participantCount: Number(row.participant_count ?? 0),
    classCount: Number(row.class_count ?? 0),
    nextEvent: row.next_event,
    averageAttendance:
      row.average_attendance === null ? null : Number(row.average_attendance),
    accessMode: admin ? "ADMIN" : "ASSIGNED",
    permissions: admin
      ? [...DEPARTMENT_LOCAL_PERMISSIONS]
      : JSON.parse(row.local_permissions || "[]"),
  };
}
const DEPARTMENT_SELECT = `SELECT d.*,u.name unit_name,
 (SELECT COUNT(*) FROM department_participants p WHERE p.department_id=d.id AND p.tenant_id=d.tenant_id AND p.status='ATIVO') participant_count,
 (SELECT COUNT(*) FROM ebd_classes c WHERE c.department_id=d.id AND c.tenant_id=d.tenant_id AND c.status='ATIVO') class_count,
 (SELECT MIN(e.event_date) FROM department_events e WHERE e.department_id=d.id AND e.tenant_id=d.tenant_id AND e.status='AGENDADO' AND e.event_date>=date('now')) next_event,
 (SELECT ROUND(100.0*SUM(CASE WHEN a.attendance_status='PRESENTE' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) FROM department_attendance a JOIN department_activities x ON x.id=a.activity_id WHERE a.department_id=d.id AND a.tenant_id=d.tenant_id AND x.status='FINALIZADA') average_attendance,
 (SELECT access.permissions_json FROM department_access access WHERE access.department_id=d.id AND access.membership_id=? AND access.status='ATIVO') local_permissions
 FROM departments d JOIN organizational_units u ON u.id=d.unit_id AND u.tenant_id=d.tenant_id`;
function scopeClause(session: DepartmentContext["session"]) {
  if (session.user.scope === "MATRIZ")
    return { sql: "d.matrix_id=?", args: [session.user.boundMatrixId] };
  if (session.user.scope === "FILIAL")
    return { sql: "d.branch_id=?", args: [session.user.boundBranchId] };
  return { sql: "d.convention_id=?", args: [session.user.conventionId] };
}
async function listContext(request: Request) {
  return requireAnyPermission(request, [
    "DEPARTAMENTO_VISUALIZAR",
    "EBD_VISUALIZAR",
  ]);
}
export async function listDepartments(
  request: Request,
  query: Record<string, unknown>,
) {
  const { session, permissions } = await listContext(request),
    membership = session.user.membershipId ?? -1,
    admin = permissions.has("DEPARTAMENTO_CONFIGURAR"),
    scope = scopeClause(session),
    page = Math.max(1, Number(query.page) || 1),
    pageSize = Math.min(48, Math.max(6, Number(query.pageSize) || 24)),
    where = ["d.tenant_id=?", scope.sql],
    args: unknown[] = [session.user.tenantId, ...scope.args];
  if (!admin) {
    where.push(
      "EXISTS(SELECT 1 FROM department_access da WHERE da.department_id=d.id AND da.tenant_id=d.tenant_id AND da.membership_id=? AND da.status='ATIVO')",
    );
    args.push(membership);
  }
  if (query.status === "INATIVO") where.push("d.status='INATIVO'");
  else where.push("d.status='ATIVO'");
  if (typeof query.search === "string" && query.search.trim()) {
    where.push(
      "(d.name LIKE ? COLLATE NOCASE OR d.acronym LIKE ? COLLATE NOCASE)",
    );
    const q = `%${query.search.trim().slice(0, 100)}%`;
    args.push(q, q);
  }
  const total = Number(
    (
      await database()
        .prepare(
          `SELECT COUNT(*) total FROM departments d WHERE ${where.join(" AND ")}`,
        )
        .bind(...args)
        .first<{ total: number }>()
    )?.total ?? 0,
  );
  const rows = await database()
    .prepare(
      `${DEPARTMENT_SELECT} WHERE ${where.join(" AND ")} ORDER BY d.name COLLATE NOCASE LIMIT ? OFFSET ?`,
    )
    .bind(membership, ...args, pageSize, (page - 1) * pageSize)
    .all<DepartmentRow>();
  return {
    items: rows.results.map((row) => mapDepartment(row, admin)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    canCreate: permissions.has("DEPARTAMENTO_CONFIGURAR"),
  };
}

async function departmentContext(
  request: Request,
  id: number,
  required: PermissionCode,
): Promise<DepartmentContext> {
  const { session, permissions } = await requirePermission(request, required),
    membership = session.user.membershipId ?? -1,
    admin = permissions.has("DEPARTAMENTO_CONFIGURAR");
  const scope = scopeClause(session);
  const row = await database()
    .prepare(
      `${DEPARTMENT_SELECT} WHERE d.id=? AND d.tenant_id=? AND ${scope.sql}`,
    )
    .bind(membership, id, session.user.tenantId, ...scope.args)
    .first<DepartmentRow>();
  if (!row)
    throw new ApiError(
      404,
      "DEPARTAMENTO_NAO_ENCONTRADO",
      "Departamento não encontrado.",
    );
  const local = new Set<string>(
    row.local_permissions ? JSON.parse(row.local_permissions) : [],
  );
  if (!admin && !local.has(required))
    throw new ApiError(
      403,
      "ESCOPO_DEPARTAMENTAL_NEGADO",
      "Seu acesso não inclui esta ação neste departamento.",
    );
  return {
    session,
    permissions,
    department: row,
    localPermissions: local,
    admin,
  };
}
async function auditStatements(
  ctx: DepartmentContext,
  action: string,
  entityType: string,
  entityId: number,
  previous: unknown,
  next: unknown,
  reason: string | null = null,
) {
  return database()
    .prepare(
      "INSERT INTO department_audit(tenant_id,department_id,actor_user_id,actor_membership_id,action,entity_type,entity_id,previous_values,new_values,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      ctx.session.user.tenantId,
      ctx.department.id,
      ctx.session.user.id,
      ctx.session.user.membershipId,
      action,
      entityType,
      entityId,
      previous === null ? null : JSON.stringify(previous),
      next === null ? null : JSON.stringify(next),
      reason,
      now(),
    );
}
function notificationStatements(input: {
  tenantId: number;
  departmentId: number;
  unitId: number;
  type: string;
  title: string;
  message: string;
  route: string;
  userIds: number[];
}) {
  if (!input.userIds.length) return [];
  const id = generatedId(),
    time = now();
  return [
    database()
      .prepare(
        "INSERT INTO notifications(id,tenant_id,audience,type,title,message,priority,internal_route,source_entity,source_entity_id,unit_id,group_key,metadata_json,mandatory,created_at,updated_at) VALUES(?,?,'ORGANIZATIONAL',?,?,?,'ATENCAO',?,'DEPARTMENT',?,?,?,NULL,0,?,?)",
      )
      .bind(
        id,
        input.tenantId,
        input.type,
        input.title,
        input.message,
        input.route,
        input.departmentId,
        input.unitId,
        input.type,
        time,
        time,
      ),
    ...input.userIds.map((userId) =>
      database()
        .prepare(
          "INSERT OR IGNORE INTO notification_recipients(notification_id,user_id,created_at) VALUES(?,?,?)",
        )
        .bind(id, userId, time),
    ),
  ];
}
async function departmentRecipientIds(departmentId: number, tenantId: number) {
  const rows = await database()
    .prepare(
      "SELECT DISTINCT m.user_id FROM department_access a JOIN tenant_memberships m ON m.id=a.membership_id AND m.tenant_id=a.tenant_id JOIN auth_users u ON u.id=m.user_id WHERE a.department_id=? AND a.tenant_id=? AND a.status='ATIVO' AND m.status='ATIVO' AND m.archived_at IS NULL AND u.status='ATIVO' AND u.archived_at IS NULL UNION SELECT DISTINCT u.id FROM department_participants p JOIN people person ON person.id=p.person_id AND person.tenant_id=p.tenant_id JOIN auth_users u ON u.id=person.linked_auth_user_id WHERE p.department_id=? AND p.tenant_id=? AND p.status='ATIVO' AND u.status='ATIVO' AND u.archived_at IS NULL",
    )
    .bind(departmentId, tenantId, departmentId, tenantId)
    .all<{ user_id: number }>();
  return rows.results.map((row) => row.user_id);
}
async function departmentAbsenceAlerts(
  tenantId: number,
  departmentId: number,
  threshold: number,
  classId?: number,
) {
  const rows = await database()
    .prepare(
      `WITH ranked AS (
 SELECT a.student_id person_id,s.full_name,c.name class_name,a.attendance_status,m.meeting_date,
 ROW_NUMBER() OVER(PARTITION BY a.student_id,a.class_id ORDER BY m.meeting_date DESC,m.id DESC) recent_position
 FROM ebd_student_attendance a
 JOIN ebd_meetings m ON m.id=a.meeting_id AND m.tenant_id=a.tenant_id
 JOIN ebd_classes c ON c.id=a.class_id AND c.tenant_id=a.tenant_id
 JOIN ebd_student_enrollments e ON e.class_id=a.class_id AND e.student_id=a.student_id AND e.tenant_id=a.tenant_id AND e.status='ATIVO'
 JOIN ebd_students s ON s.id=a.student_id AND s.tenant_id=a.tenant_id
 WHERE a.tenant_id=? AND c.department_id=? AND (? IS NULL OR a.class_id=?)
 ) SELECT person_id,full_name,class_name,attendance_status FROM ranked WHERE recent_position<=? ORDER BY person_id,recent_position`,
    )
    .bind(tenantId, departmentId, classId ?? null, classId ?? null, threshold)
    .all<{
      person_id: number;
      full_name: string;
      class_name: string;
      attendance_status: string;
    }>();
  const grouped = new Map<
    number,
    {
      personId: number;
      fullName: string;
      className: string;
      statuses: string[];
    }
  >();
  for (const row of rows.results) {
    const item = grouped.get(row.person_id) ?? {
      personId: row.person_id,
      fullName: row.full_name,
      className: row.class_name,
      statuses: [],
    };
    item.statuses.push(row.attendance_status);
    grouped.set(row.person_id, item);
  }
  return [...grouped.values()]
    .map((item) => ({
      personId: item.personId,
      fullName: item.fullName,
      className: item.className,
      consecutive: consecutiveAbsences(item.statuses),
    }))
    .filter((item) => item.consecutive >= threshold);
}

async function unitScope(tenantId: number, unitId: number) {
  return database()
    .prepare(
      "SELECT u.id,u.tenant_id,u.type,CASE WHEN u.type='CONVENCAO' THEN u.id WHEN u.type='MATRIZ' THEN u.parent_id ELSE gp.id END convention_id,CASE WHEN u.type='MATRIZ' THEN u.id WHEN u.type='FILIAL' THEN p.id ELSE NULL END matrix_id,CASE WHEN u.type='FILIAL' THEN u.id ELSE NULL END branch_id FROM organizational_units u LEFT JOIN organizational_units p ON p.id=u.parent_id AND p.tenant_id=u.tenant_id LEFT JOIN organizational_units gp ON gp.id=p.parent_id AND gp.tenant_id=u.tenant_id WHERE u.id=? AND u.tenant_id=? AND u.status='ATIVO' AND u.archived_at IS NULL",
    )
    .bind(unitId, tenantId)
    .first<{
      id: number;
      tenant_id: number;
      type: string;
      convention_id: number;
      matrix_id: number | null;
      branch_id: number | null;
    }>();
}
export async function createDepartment(
  request: Request,
  input: Record<string, unknown>,
) {
  const { session } = await requirePermission(
      request,
      "DEPARTAMENTO_CONFIGURAR",
    ),
    name = clean(input.name, 160),
    unitId = positive(input.unitId),
    type = departmentTypes.has(input.type as DepartmentType)
      ? (input.type as DepartmentType)
      : "DEPARTAMENTO";
  if (name.length < 2 || !unitId)
    throw new ApiError(
      400,
      "DADOS_INVALIDOS",
      "Informe nome e unidade do departamento.",
    );
  const unit = await unitScope(session.user.tenantId, unitId);
  if (
    !unit ||
    !departmentWithinOrganizationalScope(
      {
        tenantId: session.user.tenantId,
        conventionId: session.user.conventionId,
        scope: session.user.scope,
        boundMatrixId: session.user.boundMatrixId,
        boundBranchId: session.user.boundBranchId,
      },
      {
        tenantId: unit.tenant_id,
        conventionId: unit.convention_id,
        matrixId: unit.matrix_id,
        branchId: unit.branch_id,
      },
    )
  )
    throw new ApiError(403, "FORA_DO_ESCOPO", "Unidade fora do seu escopo.");
  const id = generatedId(),
    time = now(),
    features = jsonArray(input.enabledFeatures);
  if (type === "ESCOLA_BIBLICA" && !features.includes("EBD"))
    features.push("EBD");
  const roleNames = [
    "Presidente",
    "Coordenador",
    "Diretor",
    "Secretário",
    "Tesoureiro",
    "Professor",
    "Auxiliar",
    "Membro",
  ];
  const statements: D1PreparedStatement[] = [
    database()
      .prepare(
        "INSERT INTO departments(id,tenant_id,name,acronym,description,type,unit_id,convention_id,matrix_id,branch_id,status,enabled_features,absence_alert_threshold,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        session.user.tenantId,
        name,
        clean(input.acronym, 20) || null,
        clean(input.description, 700) || null,
        type,
        unitId,
        unit.convention_id,
        unit.matrix_id,
        unit.branch_id,
        "ATIVO",
        JSON.stringify(
          features.length
            ? features
            : ["PARTICIPANTES", "AGENDA", "FREQUENCIA", "COMUNICACAO"],
        ),
        Math.min(20, Math.max(1, Number(input.absenceAlertThreshold) || 3)),
        session.user.id,
        time,
        time,
      ),
    ...roleNames.map((role, index) =>
      database()
        .prepare(
          "INSERT INTO department_roles(id,tenant_id,department_id,name,is_leadership,display_order,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'ATIVO',?,?)",
        )
        .bind(
          generatedId(),
          session.user.tenantId,
          id,
          role,
          index < 5 ? 1 : 0,
          index,
          time,
          time,
        ),
    ),
    database()
      .prepare(
        "INSERT INTO department_audit(tenant_id,department_id,actor_user_id,actor_membership_id,action,entity_type,entity_id,new_values,created_at) VALUES(?,?,?,?, 'DEPARTAMENTO_CRIADO','DEPARTMENT',?,?,?)",
      )
      .bind(
        session.user.tenantId,
        id,
        session.user.id,
        session.user.membershipId,
        id,
        JSON.stringify({ name, type, unitId }),
        time,
      ),
  ];
  await database().batch(statements);
  return { id };
}

export async function departmentOverview(request: Request, id: number) {
  const ctx = await departmentContext(request, id, "DEPARTAMENTO_VISUALIZAR"),
    tenant = ctx.session.user.tenantId;
  const [
    roles,
    participants,
    access,
    events,
    activities,
    classes,
    students,
    meetings,
    dashboard,
  ] = await Promise.all([
    database()
      .prepare(
        "SELECT id,name,is_leadership,status FROM department_roles WHERE tenant_id=? AND department_id=? ORDER BY display_order,name",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT p.person_id,p.joined_at,p.status,p.notes,person.full_name,person.member_number,person.phone,person.whatsapp,r.id role_id,r.name role_name FROM department_participants p JOIN people person ON person.id=p.person_id AND person.tenant_id=p.tenant_id LEFT JOIN department_roles r ON r.id=p.role_id WHERE p.tenant_id=? AND p.department_id=? ORDER BY p.status,person.full_name LIMIT 200",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT a.membership_id,a.permissions_json,a.status,m.display_name,m.role_name,r.name department_role FROM department_access a JOIN tenant_memberships m ON m.id=a.membership_id AND m.tenant_id=a.tenant_id LEFT JOIN department_roles r ON r.id=a.role_id WHERE a.tenant_id=? AND a.department_id=? ORDER BY m.display_name LIMIT 100",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT e.*,p.full_name responsible_name FROM department_events e LEFT JOIN people p ON p.id=e.responsible_person_id AND p.tenant_id=e.tenant_id WHERE e.tenant_id=? AND e.department_id=? ORDER BY e.event_date DESC,e.start_time DESC LIMIT 100",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT x.*,(SELECT COUNT(*) FROM department_attendance a WHERE a.activity_id=x.id AND a.attendance_status='PRESENTE') present_count FROM department_activities x WHERE x.tenant_id=? AND x.department_id=? ORDER BY x.activity_date DESC LIMIT 50",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT c.*,(SELECT COUNT(*) FROM ebd_student_enrollments e WHERE e.class_id=c.id AND e.tenant_id=c.tenant_id AND e.status='ATIVO') student_count,(SELECT GROUP_CONCAT(m.display_name,', ') FROM ebd_class_teachers t JOIN tenant_memberships m ON m.id=t.membership_id WHERE t.class_id=c.id AND t.status='ATIVO') teacher_names FROM ebd_classes c WHERE c.tenant_id=? AND c.department_id=? ORDER BY c.status,c.name LIMIT 200",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT s.id student_id,s.person_id,s.full_name,s.birth_date,s.phone,s.whatsapp,s.guardian_name,s.guardian_phone,s.status,e.class_id,e.enrolled_at,c.name class_name,p.member_number FROM ebd_students s LEFT JOIN ebd_student_enrollments e ON e.student_id=s.id AND e.tenant_id=s.tenant_id AND e.status='ATIVO' LEFT JOIN ebd_classes c ON c.id=e.class_id AND c.tenant_id=e.tenant_id LEFT JOIN people p ON p.id=s.person_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=? AND s.department_id=? ORDER BY s.status,s.full_name LIMIT 500",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT m.*,(SELECT COUNT(*) FROM ebd_class_summaries s WHERE s.meeting_id=m.id AND s.status='FINALIZADA') finalized_classes,(SELECT COUNT(*) FROM ebd_classes c WHERE c.department_id=m.department_id AND c.tenant_id=m.tenant_id AND c.status='ATIVO') total_classes FROM ebd_meetings m WHERE m.tenant_id=? AND m.department_id=? ORDER BY m.meeting_date DESC LIMIT 50",
      )
      .bind(tenant, id)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT (SELECT COUNT(*) FROM ebd_student_enrollments e WHERE e.department_id=? AND e.tenant_id=? AND e.status='ATIVO') enrolled,(SELECT COUNT(*) FROM ebd_classes c WHERE c.department_id=? AND c.tenant_id=? AND c.status='ATIVO') classes,(SELECT COALESCE(SUM(visitor_total),0) FROM ebd_closures f WHERE f.department_id=? AND f.tenant_id=?) visitors,(SELECT COALESCE(AVG(CASE WHEN enrolled_total>0 THEN 100.0*present_total/enrolled_total END),0) FROM ebd_closures f WHERE f.department_id=? AND f.tenant_id=?) frequency_average,(SELECT offering_total_cents FROM ebd_closures f WHERE f.department_id=? AND f.tenant_id=? ORDER BY finalized_at DESC LIMIT 1) last_offering",
      )
      .bind(id, tenant, id, tenant, id, tenant, id, tenant, id, tenant)
      .first<Record<string, number>>(),
  ]);
  return {
    department: mapDepartment(ctx.department, ctx.admin),
    roles: roles.results,
    participants: participants.results,
    access: access.results.map((row) => ({
      ...row,
      permissions: JSON.parse(String(row.permissions_json ?? "[]")),
    })),
    events: events.results,
    activities: activities.results,
    classes: classes.results,
    students: students.results,
    meetings: meetings.results,
    dashboard: dashboard ?? {},
  };
}

export async function departmentOptions(
  request: Request,
  id: number,
  query: Record<string, unknown>,
) {
  const ctx = await departmentContext(request, id, "DEPARTAMENTO_VISUALIZAR"),
    q = `%${clean(query.search, 100)}%`,
    tenant = ctx.session.user.tenantId,
    department = ctx.department;
  const personWhere = department.branch_id
      ? "p.branch_id=?"
      : department.matrix_id
        ? "p.matrix_id=?"
        : "1=1",
    personArgs = department.branch_id
      ? [department.branch_id]
      : department.matrix_id
        ? [department.matrix_id]
        : [];
  const [people, memberships] = await Promise.all([
    database()
      .prepare(
        `SELECT p.id,p.full_name,p.member_number,p.phone,p.whatsapp,p.status FROM people p WHERE p.tenant_id=? AND ${personWhere} AND (p.full_name LIKE ? COLLATE NOCASE OR p.phone LIKE ?) ORDER BY p.full_name LIMIT 30`,
      )
      .bind(tenant, ...personArgs, q, q)
      .all<Record<string, unknown>>(),
    database()
      .prepare(
        "SELECT m.id,m.display_name,m.role_name,m.scope,u.name scope_unit_name FROM tenant_memberships m JOIN organizational_units u ON u.id=m.scope_unit_id AND u.tenant_id=m.tenant_id WHERE m.tenant_id=? AND m.status='ATIVO' AND m.archived_at IS NULL AND m.display_name LIKE ? COLLATE NOCASE ORDER BY m.display_name LIMIT 30",
      )
      .bind(tenant, q)
      .all<Record<string, unknown>>(),
  ]);
  return { people: people.results, memberships: memberships.results };
}

function localPermissions(value: unknown): DepartmentLocalPermission[] {
  return jsonArray(value).filter((item) =>
    DEPARTMENT_LOCAL_PERMISSIONS.includes(item as DepartmentLocalPermission),
  ) as DepartmentLocalPermission[];
}
export async function departmentOperation(
  request: Request,
  id: number,
  input: Record<string, unknown>,
) {
  const action = String(input.action ?? "");
  if (action === "updateDepartment") {
    const ctx = await departmentContext(request, id, "DEPARTAMENTO_CONFIGURAR"),
      expected = Number(input.version);
    if (expected !== ctx.department.version)
      throw new ApiError(
        409,
        "REGISTRO_ATUALIZADO",
        "Este departamento foi alterado por outra pessoa. Atualize a página.",
      );
    const next = {
        name: clean(input.name, 160) || ctx.department.name,
        acronym: clean(input.acronym, 20) || null,
        description: clean(input.description, 700) || null,
        status: statusValue(input.status),
        absenceAlertThreshold: Math.min(
          20,
          Math.max(1, Number(input.absenceAlertThreshold) || 3),
        ),
      },
      time = now();
    await database().batch([
      database()
        .prepare(
          "UPDATE departments SET name=?,acronym=?,description=?,status=?,absence_alert_threshold=?,version=version+1,updated_at=? WHERE id=? AND tenant_id=? AND version=?",
        )
        .bind(
          next.name,
          next.acronym,
          next.description,
          next.status,
          next.absenceAlertThreshold,
          time,
          id,
          ctx.session.user.tenantId,
          expected,
        ),
      await auditStatements(
        ctx,
        "DEPARTAMENTO_EDITADO",
        "DEPARTMENT",
        id,
        { version: expected },
        next,
      ),
    ]);
    return { message: "Departamento atualizado." };
  }
  if (action === "createRole") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_LIDERANCA_GERENCIAR",
      ),
      roleId = generatedId(),
      time = now(),
      name = clean(input.name, 100);
    if (name.length < 2)
      throw new ApiError(400, "DADOS_INVALIDOS", "Informe o nome da função.");
    await database().batch([
      database()
        .prepare(
          "INSERT INTO department_roles(id,tenant_id,department_id,name,is_leadership,display_order,status,created_at,updated_at) VALUES(?,?,?,?,?,100,'ATIVO',?,?)",
        )
        .bind(
          roleId,
          ctx.session.user.tenantId,
          id,
          name,
          input.isLeadership === true ? 1 : 0,
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "FUNCAO_DEPARTAMENTAL_CRIADA",
        "DEPARTMENT_ROLE",
        roleId,
        null,
        { name },
      ),
    ]);
    return { message: "Função criada." };
  }
  if (action === "addParticipant") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_PARTICIPANTES_GERENCIAR",
      ),
      personId = positive(input.personId),
      roleId = positive(input.roleId),
      time = now();
    if (!personId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione uma pessoa.");
    const person = await database()
      .prepare("SELECT id FROM people WHERE id=? AND tenant_id=?")
      .bind(personId, ctx.session.user.tenantId)
      .first();
    if (!person)
      throw new ApiError(
        404,
        "PESSOA_NAO_ENCONTRADA",
        "Pessoa não encontrada.",
      );
    await database().batch([
      database()
        .prepare(
          "INSERT INTO department_participants(department_id,tenant_id,person_id,role_id,joined_at,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,'ATIVO',?,?,?) ON CONFLICT(department_id,person_id) DO UPDATE SET role_id=excluded.role_id,status='ATIVO',left_at=NULL,exit_reason=NULL,notes=excluded.notes,updated_at=excluded.updated_at",
        )
        .bind(
          id,
          ctx.session.user.tenantId,
          personId,
          roleId,
          clean(input.joinedAt, 10) || time.slice(0, 10),
          clean(input.notes, 500) || null,
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "PARTICIPANTE_VINCULADO",
        "PERSON",
        personId,
        null,
        { roleId },
      ),
    ]);
    return { message: "Participante adicionado." };
  }
  if (action === "grantAccess") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_LIDERANCA_GERENCIAR",
      ),
      membershipId = positive(input.membershipId),
      roleId = positive(input.roleId),
      permissions = localPermissions(input.permissions),
      time = now();
    if (!membershipId || !permissions.includes("DEPARTAMENTO_VISUALIZAR"))
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Selecione o usuário e libere Visualizar departamento.",
      );
    const membership = await database()
      .prepare(
        "SELECT id FROM tenant_memberships WHERE id=? AND tenant_id=? AND status='ATIVO' AND archived_at IS NULL",
      )
      .bind(membershipId, ctx.session.user.tenantId)
      .first();
    if (!membership)
      throw new ApiError(
        404,
        "USUARIO_NAO_ENCONTRADO",
        "Usuário não encontrado.",
      );
    await database().batch([
      database()
        .prepare(
          "INSERT INTO department_access(department_id,tenant_id,membership_id,role_id,permissions_json,status,created_at,updated_at) VALUES(?,?,?,?,?,'ATIVO',?,?) ON CONFLICT(department_id,membership_id) DO UPDATE SET role_id=excluded.role_id,permissions_json=excluded.permissions_json,status='ATIVO',updated_at=excluded.updated_at",
        )
        .bind(
          id,
          ctx.session.user.tenantId,
          membershipId,
          roleId,
          JSON.stringify(permissions),
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "ACESSO_DEPARTAMENTAL_CONCEDIDO",
        "MEMBERSHIP",
        membershipId,
        null,
        { permissions },
      ),
    ]);
    return { message: "Acesso individual atualizado." };
  }
  if (action === "createEvent") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_AGENDA_GERENCIAR",
      ),
      eventId = generatedId(),
      title = clean(input.title, 180),
      date = clean(input.eventDate, 10),
      time = now();
    if (title.length < 2 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Informe título e data do evento.",
      );
    const recipients = await departmentRecipientIds(
      id,
      ctx.session.user.tenantId,
    );
    await database().batch([
      database()
        .prepare(
          "INSERT INTO department_events(id,tenant_id,department_id,title,description,event_date,start_time,location,responsible_person_id,notes,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'AGENDADO',?,?,?)",
        )
        .bind(
          eventId,
          ctx.session.user.tenantId,
          id,
          title,
          clean(input.description, 700) || null,
          date,
          clean(input.startTime, 5) || null,
          clean(input.location, 180) || null,
          positive(input.responsiblePersonId),
          clean(input.notes, 500) || null,
          ctx.session.user.id,
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "EVENTO_DEPARTAMENTAL_CRIADO",
        "DEPARTMENT_EVENT",
        eventId,
        null,
        { title, date },
      ),
      ...notificationStatements({
        tenantId: ctx.session.user.tenantId,
        departmentId: id,
        unitId: ctx.department.unit_id,
        type: "DEPARTAMENTO_EVENTO_PROXIMO",
        title: "Novo evento do departamento",
        message: `${title} em ${date.split("-").reverse().join("/")}.`,
        route: `/painel/departamentos?abrir=${id}&aba=agenda`,
        userIds: recipients,
      }),
    ]);
    return { message: "Evento adicionado à agenda." };
  }
  if (action === "activity") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_FREQUENCIA_VISUALIZAR",
      ),
      activityId = positive(input.activityId);
    if (!activityId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a chamada.");
    const activity = await database()
      .prepare(
        "SELECT id,title,activity_date,notes,status,version,finalized_at FROM department_activities WHERE id=? AND tenant_id=? AND department_id=?",
      )
      .bind(activityId, ctx.session.user.tenantId, id)
      .first<Record<string, unknown>>();
    if (!activity)
      throw new ApiError(
        404,
        "CHAMADA_NAO_ENCONTRADA",
        "Chamada não encontrada.",
      );
    const participants = await database()
      .prepare(
        "SELECT a.person_id,a.attendance_status,p.full_name,p.member_number FROM department_attendance a JOIN people p ON p.id=a.person_id AND p.tenant_id=a.tenant_id WHERE a.activity_id=? AND a.tenant_id=? AND a.department_id=? ORDER BY p.full_name COLLATE NOCASE LIMIT 1000",
      )
      .bind(activityId, ctx.session.user.tenantId, id)
      .all<Record<string, unknown>>();
    return { activity, participants: participants.results };
  }
  if (action === "createActivity") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_FREQUENCIA_LANCAR",
      ),
      activityId = generatedId(),
      time = now(),
      date = clean(input.activityDate, 10),
      title = clean(input.title, 180);
    if (!date || !title)
      throw new ApiError(400, "DADOS_INVALIDOS", "Informe atividade e data.");
    const participants = await database()
      .prepare(
        "SELECT person_id FROM department_participants WHERE tenant_id=? AND department_id=? AND status='ATIVO'",
      )
      .bind(ctx.session.user.tenantId, id)
      .all<{ person_id: number }>();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO department_activities(id,tenant_id,department_id,activity_date,title,notes,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,'ABERTA',?,?,?)",
        )
        .bind(
          activityId,
          ctx.session.user.tenantId,
          id,
          date,
          title,
          clean(input.notes, 500) || null,
          ctx.session.user.id,
          time,
          time,
        ),
      ...participants.results.map((p) =>
        database()
          .prepare(
            "INSERT INTO department_attendance(activity_id,tenant_id,department_id,person_id,attendance_status,updated_by_user_id,updated_at) VALUES(?,?,?,?,'NAO_INFORMADO',?,?)",
          )
          .bind(
            activityId,
            ctx.session.user.tenantId,
            id,
            p.person_id,
            ctx.session.user.id,
            time,
          ),
      ),
      await auditStatements(
        ctx,
        "FREQUENCIA_CRIADA",
        "DEPARTMENT_ACTIVITY",
        activityId,
        null,
        { title, date },
      ),
    ]);
    return { message: "Chamada criada.", activityId };
  }
  if (action === "saveActivityAttendance") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_FREQUENCIA_LANCAR",
      ),
      activityId = positive(input.activityId),
      records = Array.isArray(input.records) ? input.records : [],
      time = now();
    const activity = activityId
      ? await database()
          .prepare(
            "SELECT id,status FROM department_activities WHERE id=? AND tenant_id=? AND department_id=?",
          )
          .bind(activityId, ctx.session.user.tenantId, id)
          .first<{ id: number; status: string }>()
      : null;
    if (!activity || activity.status === "FINALIZADA")
      throw new ApiError(409, "CHAMADA_FECHADA", "A chamada não está aberta.");
    const statements = records.slice(0, 1000).flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>,
        personId = positive(item.personId),
        status = [
          "PRESENTE",
          "AUSENTE",
          "JUSTIFICADO",
          "NAO_INFORMADO",
        ].includes(String(item.status))
          ? String(item.status)
          : "NAO_INFORMADO";
      return personId
        ? [
            database()
              .prepare(
                "UPDATE department_attendance SET attendance_status=?,updated_by_user_id=?,updated_at=? WHERE activity_id=? AND tenant_id=? AND department_id=? AND person_id=?",
              )
              .bind(
                status,
                ctx.session.user.id,
                time,
                activityId,
                ctx.session.user.tenantId,
                id,
                personId,
              ),
          ]
        : [];
    });
    await database().batch(statements);
    return { message: "Chamada salva." };
  }
  if (action === "finalizeActivity") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_FREQUENCIA_LANCAR",
      ),
      activityId = positive(input.activityId),
      time = now();
    if (!activityId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a chamada.");
    const pending = Number(
      (
        await database()
          .prepare(
            "SELECT COUNT(*) total FROM department_attendance WHERE activity_id=? AND tenant_id=? AND attendance_status='NAO_INFORMADO'",
          )
          .bind(activityId, ctx.session.user.tenantId)
          .first<{ total: number }>()
      )?.total ?? 0,
    );
    if (pending)
      throw new ApiError(
        409,
        "CHAMADA_INCOMPLETA",
        `Ainda existem ${pending} participantes sem marcação.`,
      );
    await database().batch([
      database()
        .prepare(
          "UPDATE department_activities SET status='FINALIZADA',finalized_by_user_id=?,finalized_at=?,version=version+1,updated_at=? WHERE id=? AND tenant_id=? AND department_id=? AND status='ABERTA'",
        )
        .bind(
          ctx.session.user.id,
          time,
          time,
          activityId,
          ctx.session.user.tenantId,
          id,
        ),
      await auditStatements(
        ctx,
        "FREQUENCIA_FINALIZADA",
        "DEPARTMENT_ACTIVITY",
        activityId,
        null,
        { finalizedAt: time },
      ),
    ]);
    return { message: "Chamada finalizada." };
  }
  if (action === "createClass") {
    const ctx = await departmentContext(request, id, "EBD_CLASSES_GERENCIAR");
    if (
      ctx.department.type !== "ESCOLA_BIBLICA" &&
      !mapDepartment(ctx.department, ctx.admin).enabledFeatures.includes("EBD")
    )
      throw new ApiError(
        400,
        "EBD_NAO_HABILITADA",
        "O recurso Escola Bíblica não está habilitado.",
      );
    const classId = generatedId(),
      time = now(),
      name = clean(input.name, 120);
    if (name.length < 2)
      throw new ApiError(400, "DADOS_INVALIDOS", "Informe o nome da classe.");
    await database().batch([
      database()
        .prepare(
          "INSERT INTO ebd_classes(id,tenant_id,department_id,name,description,age_range,room,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'ATIVO',?,?)",
        )
        .bind(
          classId,
          ctx.session.user.tenantId,
          id,
          name,
          clean(input.description, 500) || null,
          clean(input.ageRange, 80) || null,
          clean(input.room, 100) || null,
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "EBD_CLASSE_CRIADA",
        "EBD_CLASS",
        classId,
        null,
        { name },
      ),
    ]);
    return { message: "Classe criada.", classId };
  }
  if (action === "assignTeacher") {
    const ctx = await departmentContext(request, id, "EBD_CLASSES_GERENCIAR"),
      classId = positive(input.classId),
      membershipId = positive(input.membershipId),
      time = now(),
      role = ["PRINCIPAL", "AUXILIAR", "SUBSTITUTO"].includes(
        String(input.teacherRole),
      )
        ? String(input.teacherRole)
        : "AUXILIAR";
    if (!classId || !membershipId)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Selecione classe e professor.",
      );
    const valid = await database()
      .prepare(
        "SELECT c.id FROM ebd_classes c JOIN tenant_memberships m ON m.id=? AND m.tenant_id=c.tenant_id WHERE c.id=? AND c.department_id=? AND c.tenant_id=? AND m.status='ATIVO' AND m.archived_at IS NULL",
      )
      .bind(membershipId, classId, id, ctx.session.user.tenantId)
      .first();
    if (!valid)
      throw new ApiError(
        404,
        "VINCULO_NAO_ENCONTRADO",
        "Classe ou usuário inválido.",
      );
    await database().batch([
      database()
        .prepare(
          "INSERT INTO ebd_class_teachers(class_id,tenant_id,membership_id,person_id,teacher_role,status,created_at,updated_at) VALUES(?,?,?,?,?,'ATIVO',?,?) ON CONFLICT(class_id,membership_id) DO UPDATE SET teacher_role=excluded.teacher_role,status='ATIVO',updated_at=excluded.updated_at",
        )
        .bind(
          classId,
          ctx.session.user.tenantId,
          membershipId,
          positive(input.personId),
          role,
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "EBD_PROFESSOR_VINCULADO",
        "EBD_CLASS",
        classId,
        null,
        { membershipId, role },
      ),
    ]);
    return { message: "Professor vinculado." };
  }
  if (action === "enrollStudent") {
    const ctx = await departmentContext(request, id, "EBD_ALUNOS_GERENCIAR"),
      classId = positive(input.classId),
      personId = positive(input.personId),
      requestedStudentId = positive(input.studentId),
      time = now();
    if (!classId || (!personId && !requestedStudentId))
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Selecione a pessoa ou o aluno da EBD e a classe.",
      );
    const validClass = await database()
      .prepare(
        "SELECT id FROM ebd_classes WHERE id=? AND department_id=? AND tenant_id=? AND status='ATIVO'",
      )
      .bind(classId, id, ctx.session.user.tenantId)
      .first();
    if (!validClass)
      throw new ApiError(
        404,
        "CLASSE_NAO_ENCONTRADA",
        "Classe não encontrada.",
      );
    let studentId = requestedStudentId;
    if (personId) {
      const person = await database()
        .prepare(
          "SELECT id,full_name,birth_date,sex,cpf,phone,whatsapp,matrix_id,branch_id FROM people WHERE id=? AND tenant_id=?",
        )
        .bind(personId, ctx.session.user.tenantId)
        .first<Record<string, unknown>>();
      if (!person)
        throw new ApiError(
          404,
          "PESSOA_NAO_ENCONTRADA",
          "Pessoa não encontrada.",
        );
      if (!personBelongsToDepartmentUnit(ctx.department, person))
        throw new ApiError(
          404,
          "PESSOA_NAO_ENCONTRADA",
          "Pessoa não encontrada no escopo desta unidade.",
        );
      const current = await database()
        .prepare(
          "SELECT id FROM ebd_students WHERE tenant_id=? AND department_id=? AND person_id=?",
        )
        .bind(ctx.session.user.tenantId, id, personId)
        .first<{ id: number }>();
      studentId = current?.id ?? generatedId();
      if (!current)
        await database()
          .prepare(
            "INSERT INTO ebd_students(id,tenant_id,department_id,person_id,full_name,birth_date,sex,cpf,phone,whatsapp,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'ATIVO',?,?,?)",
          )
          .bind(
            studentId,
            ctx.session.user.tenantId,
            id,
            personId,
            person.full_name,
            person.birth_date,
            person.sex,
            person.cpf,
            person.phone,
            person.whatsapp,
            ctx.session.user.id,
            time,
            time,
          )
          .run();
    }
    const student = studentId
      ? await database()
          .prepare(
            "SELECT id,person_id,full_name FROM ebd_students WHERE id=? AND tenant_id=? AND department_id=? AND status='ATIVO'",
          )
          .bind(studentId, ctx.session.user.tenantId, id)
          .first<{ id: number; person_id: number | null; full_name: string }>()
      : null;
    if (!student)
      throw new ApiError(404, "ALUNO_NAO_ENCONTRADO", "Aluno não encontrado.");
    const existing = await database()
      .prepare(
        "SELECT id,class_id FROM ebd_student_enrollments WHERE tenant_id=? AND department_id=? AND student_id=? AND status='ATIVO'",
      )
      .bind(ctx.session.user.tenantId, id, student.id)
      .first<{ id: number; class_id: number }>();
    const statements: D1PreparedStatement[] = [];
    if (existing && existing.class_id !== classId)
      statements.push(
        database()
          .prepare(
            "UPDATE ebd_student_enrollments SET status='TRANSFERIDO',left_at=?,updated_at=? WHERE id=?",
          )
          .bind(time.slice(0, 10), time, existing.id),
      );
    if (!existing || existing.class_id !== classId)
      statements.push(
        database()
          .prepare(
            "INSERT INTO ebd_student_enrollments(id,tenant_id,department_id,class_id,student_id,enrolled_at,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,'ATIVO',?,?,?)",
          )
          .bind(
            generatedId(),
            ctx.session.user.tenantId,
            id,
            classId,
            student.id,
            clean(input.enrolledAt, 10) || time.slice(0, 10),
            clean(input.notes, 500) || null,
            time,
            time,
          ),
      );
    statements.push(
      await auditStatements(
        ctx,
        existing ? "EBD_ALUNO_TRANSFERIDO" : "EBD_ALUNO_MATRICULADO",
        "EBD_STUDENT",
        student.id,
        existing,
        { classId, personId: student.person_id },
      ),
    );
    await database().batch(statements);
    return {
      message: existing
        ? "Aluno transferido com histórico preservado."
        : "Aluno matriculado.",
      studentId: student.id,
    };
  }
  if (action === "createIndependentStudent") {
    const ctx = await departmentContext(request, id, "EBD_ALUNOS_GERENCIAR"),
      classId = positive(input.classId),
      name = clean(input.fullName, 180),
      time = now();
    if (!classId || name.length < 2)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Informe nome completo e classe.",
      );
    const valid = await database()
      .prepare(
        "SELECT id FROM ebd_classes WHERE id=? AND tenant_id=? AND department_id=? AND status='ATIVO'",
      )
      .bind(classId, ctx.session.user.tenantId, id)
      .first();
    if (!valid)
      throw new ApiError(
        404,
        "CLASSE_NAO_ENCONTRADA",
        "Classe não encontrada.",
      );
    const studentId = generatedId(),
      enrollmentId = generatedId();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO ebd_students(id,tenant_id,department_id,person_id,full_name,birth_date,sex,cpf,phone,whatsapp,guardian_name,guardian_phone,notes,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,?,'ATIVO',?,?,?)",
        )
        .bind(
          studentId,
          ctx.session.user.tenantId,
          id,
          name,
          clean(input.birthDate, 10) || null,
          ["MASCULINO", "FEMININO", "NAO_INFORMADO"].includes(String(input.sex))
            ? input.sex
            : null,
          clean(input.cpf, 20).replace(/\D/g, "") || null,
          clean(input.phone, 30) || null,
          clean(input.whatsapp, 30) || null,
          clean(input.guardianName, 180) || null,
          clean(input.guardianPhone, 30) || null,
          clean(input.notes, 700) || null,
          ctx.session.user.id,
          time,
          time,
        ),
      database()
        .prepare(
          "INSERT INTO ebd_student_enrollments(id,tenant_id,department_id,class_id,student_id,enrolled_at,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,'ATIVO',?,?,?)",
        )
        .bind(
          enrollmentId,
          ctx.session.user.tenantId,
          id,
          classId,
          studentId,
          clean(input.enrolledAt, 10) || time.slice(0, 10),
          clean(input.notes, 500) || null,
          time,
          time,
        ),
      await auditStatements(
        ctx,
        "EBD_ALUNO_INDEPENDENTE_CRIADO",
        "EBD_STUDENT",
        studentId,
        null,
        { name, classId },
      ),
    ]);
    return { message: "Aluno cadastrado somente na EBD.", studentId };
  }
  if (action === "linkStudent") {
    const ctx = await departmentContext(request, id, "EBD_ALUNOS_GERENCIAR"),
      studentId = positive(input.studentId),
      personId = positive(input.personId),
      time = now();
    if (!studentId || !personId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione aluno e pessoa.");
    const student = await database()
        .prepare(
          "SELECT * FROM ebd_students WHERE id=? AND tenant_id=? AND department_id=?",
        )
        .bind(studentId, ctx.session.user.tenantId, id)
        .first<Record<string, unknown>>(),
      person = await database()
        .prepare(
          "SELECT id,full_name,birth_date,sex,cpf,phone,whatsapp,matrix_id,branch_id FROM people WHERE id=? AND tenant_id=?",
        )
        .bind(personId, ctx.session.user.tenantId)
        .first<Record<string, unknown>>();
    if (!student || !person)
      throw new ApiError(
        404,
        "REGISTRO_NAO_ENCONTRADO",
        "Aluno ou pessoa não encontrado.",
      );
    if (!personBelongsToDepartmentUnit(ctx.department, person))
      throw new ApiError(
        404,
        "PESSOA_NAO_ENCONTRADA",
        "Pessoa não encontrada no escopo desta unidade.",
      );
    if (student.person_id && Number(student.person_id) !== personId)
      throw new ApiError(
        409,
        "ALUNO_JA_VINCULADO",
        "Este aluno já está vinculado a outra Pessoa.",
      );
    const duplicate = await database()
      .prepare(
        "SELECT id FROM ebd_students WHERE tenant_id=? AND department_id=? AND person_id=? AND id<>?",
      )
      .bind(ctx.session.user.tenantId, id, personId, studentId)
      .first();
    if (duplicate)
      throw new ApiError(
        409,
        "PESSOA_JA_VINCULADA",
        "Esta Pessoa já possui outro aluno neste departamento.",
      );
    await database().batch([
      database()
        .prepare(
          "UPDATE ebd_students SET person_id=?,full_name=?,birth_date=COALESCE(?,birth_date),sex=COALESCE(?,sex),cpf=COALESCE(?,cpf),phone=COALESCE(?,phone),whatsapp=COALESCE(?,whatsapp),updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(
          personId,
          person.full_name,
          person.birth_date,
          person.sex,
          person.cpf,
          person.phone,
          person.whatsapp,
          time,
          studentId,
          ctx.session.user.tenantId,
        ),
      await auditStatements(
        ctx,
        "EBD_ALUNO_VINCULADO_PESSOA",
        "EBD_STUDENT",
        studentId,
        student,
        { personId },
      ),
    ]);
    return {
      message: "Aluno vinculado à Pessoa sem perder matrícula ou frequência.",
    };
  }
  if (action === "createPersonFromStudent") {
    const ctx = await departmentContext(request, id, "EBD_ALUNOS_GERENCIAR");
    if (!ctx.permissions.has("MEMBROS_CRIAR"))
      throw new ApiError(
        403,
        "PERMISSAO_NEGADA",
        "É necessária a permissão de cadastrar membros.",
      );
    const studentId = positive(input.studentId),
      time = now();
    const student = studentId
      ? await database()
          .prepare(
            "SELECT * FROM ebd_students WHERE id=? AND tenant_id=? AND department_id=?",
          )
          .bind(studentId, ctx.session.user.tenantId, id)
          .first<Record<string, unknown>>()
      : null;
    if (!student)
      throw new ApiError(404, "ALUNO_NAO_ENCONTRADO", "Aluno não encontrado.");
    if (student.person_id)
      throw new ApiError(
        409,
        "ALUNO_JA_VINCULADO",
        "Este aluno já possui Pessoa vinculada.",
      );
    if (!ctx.department.matrix_id)
      throw new ApiError(
        409,
        "MATRIZ_NAO_DEFINIDA",
        "O departamento precisa pertencer a uma Matriz ou Filial.",
      );
    const sequence = await database()
        .prepare(
          "INSERT INTO member_sequences(tenant_id,last_number,updated_at) VALUES(?,1,?) ON CONFLICT(tenant_id) DO UPDATE SET last_number=last_number+1,updated_at=excluded.updated_at RETURNING last_number",
        )
        .bind(ctx.session.user.tenantId, time)
        .first<{ last_number: number }>(),
      personId = generatedId();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO people(id,tenant_id,member_number,full_name,status,birth_date,sex,cpf,phone,whatsapp,matrix_id,branch_id,notes,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,'VISITANTE',?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          personId,
          ctx.session.user.tenantId,
          sequence!.last_number,
          student.full_name,
          student.birth_date,
          student.sex,
          student.cpf,
          student.phone,
          student.whatsapp,
          ctx.department.matrix_id,
          ctx.department.branch_id,
          student.notes,
          ctx.session.user.id,
          time,
          time,
        ),
      database()
        .prepare(
          "UPDATE ebd_students SET person_id=?,updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(personId, time, studentId, ctx.session.user.tenantId),
      database()
        .prepare(
          "INSERT INTO person_history(tenant_id,person_id,event_type,description,event_date,new_values,actor_user_id,actor_membership_id,created_at) VALUES(?,?, 'CADASTRO_VIA_EBD','Pessoa criada a partir de aluno da EBD',?,?,?,?,?)",
        )
        .bind(
          ctx.session.user.tenantId,
          personId,
          time.slice(0, 10),
          JSON.stringify({ studentId }),
          ctx.session.user.id,
          ctx.session.user.membershipId,
          time,
        ),
      await auditStatements(
        ctx,
        "EBD_ALUNO_CONVERTIDO_PESSOA",
        "EBD_STUDENT",
        Number(student.id),
        student,
        { personId },
      ),
    ]);
    return { message: "Pessoa criada e vinculada automaticamente.", personId };
  }
  if (action === "createMeeting") {
    const ctx = await departmentContext(request, id, "EBD_GERENCIAR"),
      meetingId = generatedId(),
      time = now(),
      date = clean(input.meetingDate, 10);
    if (!date)
      throw new ApiError(400, "DADOS_INVALIDOS", "Informe a data do encontro.");
    const classes = await database()
        .prepare(
          "SELECT id FROM ebd_classes WHERE tenant_id=? AND department_id=? AND status='ATIVO'",
        )
        .bind(ctx.session.user.tenantId, id)
        .all<{ id: number }>(),
      teachers = await database()
        .prepare(
          "SELECT DISTINCT m.user_id FROM ebd_class_teachers t JOIN ebd_classes c ON c.id=t.class_id AND c.tenant_id=t.tenant_id JOIN tenant_memberships m ON m.id=t.membership_id WHERE c.department_id=? AND c.tenant_id=? AND t.status='ATIVO'",
        )
        .bind(id, ctx.session.user.tenantId)
        .all<{ user_id: number }>();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO ebd_meetings(id,tenant_id,department_id,meeting_date,theme,start_time,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,'ABERTO',?,?,?)",
        )
        .bind(
          meetingId,
          ctx.session.user.tenantId,
          id,
          date,
          clean(input.theme, 240) || null,
          clean(input.startTime, 5) || null,
          ctx.session.user.id,
          time,
          time,
        ),
      ...classes.results.map((c) =>
        database()
          .prepare(
            "INSERT INTO ebd_class_summaries(meeting_id,class_id,tenant_id,status,updated_at) VALUES(?,?,?,'RASCUNHO',?)",
          )
          .bind(meetingId, c.id, ctx.session.user.tenantId, time),
      ),
      await auditStatements(
        ctx,
        "EBD_ENCONTRO_CRIADO",
        "EBD_MEETING",
        meetingId,
        null,
        { date },
      ),
      ...notificationStatements({
        tenantId: ctx.session.user.tenantId,
        departmentId: id,
        unitId: ctx.department.unit_id,
        type: "EBD_CHAMADA_DISPONIVEL",
        title: "Chamada da EBD disponível",
        message: `A chamada de ${date.split("-").reverse().join("/")} já pode ser preenchida.`,
        route: `/painel/departamentos?abrir=${id}&aba=chamada&encontro=${meetingId}`,
        userIds: teachers.results.map((t) => t.user_id),
      }),
    ]);
    return { message: "Encontro criado e professores notificados.", meetingId };
  }
  if (
    [
      "meeting",
      "saveClassAttendance",
      "addVisitor",
      "finalizeClass",
      "closeMeeting",
    ].includes(action)
  )
    return ebdMeetingOperation(request, id, input);
  if (action === "communication") {
    const ctx = await departmentContext(
        request,
        id,
        "DEPARTAMENTO_COMUNICACAO",
      ),
      message = clean(input.message, 1800),
      audience = clean(input.audience, 80) || "PARTICIPANTES_ATIVOS",
      time = now();
    if (message.length < 3)
      throw new ApiError(400, "DADOS_INVALIDOS", "Escreva a mensagem.");
    const contacts =
      audience === "ALUNOS_EBD"
        ? await database()
            .prepare(
              "SELECT s.full_name,COALESCE(p.whatsapp,p.phone,s.whatsapp,s.phone) phone FROM ebd_students s JOIN ebd_student_enrollments e ON e.student_id=s.id AND e.tenant_id=s.tenant_id AND e.status='ATIVO' LEFT JOIN people p ON p.id=s.person_id AND p.tenant_id=s.tenant_id WHERE s.department_id=? AND s.tenant_id=? AND s.status='ATIVO' AND COALESCE(p.whatsapp,p.phone,s.whatsapp,s.phone) IS NOT NULL GROUP BY s.id ORDER BY s.full_name LIMIT 1000",
            )
            .bind(id, ctx.session.user.tenantId)
            .all<{ full_name: string; phone: string }>()
        : await database()
            .prepare(
              "SELECT person.full_name,COALESCE(person.whatsapp,person.phone) phone FROM department_participants p JOIN people person ON person.id=p.person_id AND person.tenant_id=p.tenant_id LEFT JOIN department_roles r ON r.id=p.role_id WHERE p.department_id=? AND p.tenant_id=? AND p.status='ATIVO' AND (?<>'LIDERANCA' OR r.is_leadership=1) AND COALESCE(person.whatsapp,person.phone) IS NOT NULL ORDER BY person.full_name LIMIT 1000",
            )
            .bind(id, ctx.session.user.tenantId, audience)
            .all<{ full_name: string; phone: string }>();
    const logId = generatedId();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO department_communications(id,tenant_id,department_id,message,audience,channel,recipient_count,created_by_user_id,created_at) VALUES(?,?,?,?,?,'COPIAR_COMPARTILHAR',?,?,?)",
        )
        .bind(
          logId,
          ctx.session.user.tenantId,
          id,
          message,
          audience,
          contacts.results.length,
          ctx.session.user.id,
          time,
        ),
      await auditStatements(
        ctx,
        "COMUNICACAO_PREPARADA",
        "DEPARTMENT_COMMUNICATION",
        logId,
        null,
        { audience, recipients: contacts.results.length },
      ),
    ]);
    return { message: "Mensagem preparada.", contacts: contacts.results };
  }
  throw new ApiError(400, "ACAO_INVALIDA", "Ação departamental inválida.");
}

async function ebdMeetingOperation(
  request: Request,
  departmentId: number,
  input: Record<string, unknown>,
) {
  const action = String(input.action),
    meetingId = positive(input.meetingId),
    classId = positive(input.classId);
  if (!meetingId)
    throw new ApiError(400, "DADOS_INVALIDOS", "Selecione o encontro.");
  const required: PermissionCode =
      action === "closeMeeting"
        ? "EBD_FECHAMENTO"
        : action === "meeting"
          ? "EBD_VISUALIZAR"
          : "EBD_CHAMADA_LANCAR",
    ctx = await departmentContext(request, departmentId, required),
    tenant = ctx.session.user.tenantId;
  const meeting = await database()
    .prepare(
      "SELECT * FROM ebd_meetings WHERE id=? AND tenant_id=? AND department_id=?",
    )
    .bind(meetingId, tenant, departmentId)
    .first<Record<string, unknown>>();
  if (!meeting)
    throw new ApiError(
      404,
      "ENCONTRO_NAO_ENCONTRADO",
      "Encontro não encontrado.",
    );
  const secretary =
    ctx.permissions.has("EBD_SECRETARIA") &&
    (ctx.admin || ctx.localPermissions.has("EBD_SECRETARIA"));
  if (classId && !ctx.admin && !secretary) {
    const assigned = await database()
      .prepare(
        "SELECT 1 allowed FROM ebd_class_teachers WHERE class_id=? AND tenant_id=? AND membership_id=? AND status='ATIVO'",
      )
      .bind(classId, tenant, ctx.session.user.membershipId)
      .first();
    if (!assigned)
      throw new ApiError(
        403,
        "CLASSE_NAO_ATRIBUIDA",
        "Você só pode acessar as classes atribuídas ao seu usuário.",
      );
  }
  if (action === "meeting") {
    const classFilter =
        ctx.admin || secretary
          ? ""
          : " AND EXISTS(SELECT 1 FROM ebd_class_teachers t WHERE t.class_id=c.id AND t.membership_id=? AND t.status='ATIVO')",
      args = ctx.admin || secretary ? [] : [ctx.session.user.membershipId];
    const classes = await database()
      .prepare(
        `SELECT c.*,s.enrolled_count,s.present_count,s.absent_count,s.justified_count,s.visitor_count,s.bible_count,s.assistance_count,s.offering_cents,s.notes summary_notes,s.status summary_status,s.version summary_version FROM ebd_classes c JOIN ebd_class_summaries s ON s.class_id=c.id AND s.meeting_id=? WHERE c.tenant_id=? AND c.department_id=?${classFilter} ORDER BY c.name`,
      )
      .bind(meetingId, tenant, departmentId, ...args)
      .all<Record<string, unknown>>();
    let students: Record<string, unknown>[] = [];
    if (classId) {
      students = (
        await database()
          .prepare(
            "SELECT e.student_id,s.person_id,s.full_name,p.member_number,COALESCE(a.attendance_status,'NAO_INFORMADO') attendance_status FROM ebd_student_enrollments e JOIN ebd_students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id LEFT JOIN people p ON p.id=s.person_id AND p.tenant_id=s.tenant_id LEFT JOIN ebd_student_attendance a ON a.meeting_id=? AND a.class_id=e.class_id AND a.student_id=e.student_id WHERE e.class_id=? AND e.tenant_id=? AND e.status='ATIVO' ORDER BY s.full_name LIMIT 500",
          )
          .bind(meetingId, classId, tenant)
          .all<Record<string, unknown>>()
      ).results;
    }
    const visitors = classId
      ? (
          await database()
            .prepare(
              "SELECT * FROM ebd_visitors WHERE meeting_id=? AND class_id=? AND tenant_id=? ORDER BY created_at",
            )
            .bind(meetingId, classId, tenant)
            .all<Record<string, unknown>>()
        ).results
      : [];
    const closure = await database()
      .prepare("SELECT * FROM ebd_closures WHERE meeting_id=? AND tenant_id=?")
      .bind(meetingId, tenant)
      .first<Record<string, unknown>>();
    return {
      meeting,
      classes: classes.results,
      students,
      visitors,
      closure,
      canSeeAll: ctx.admin || secretary,
    };
  }
  if (action === "saveClassAttendance") {
    if (!classId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a classe.");
    const summary = await database()
      .prepare(
        "SELECT status,version FROM ebd_class_summaries WHERE meeting_id=? AND class_id=? AND tenant_id=?",
      )
      .bind(meetingId, classId, tenant)
      .first<{ status: string; version: number }>();
    if (!summary)
      throw new ApiError(
        404,
        "CHAMADA_NAO_ENCONTRADA",
        "Chamada não encontrada.",
      );
    if (
      summary.status === "FINALIZADA" &&
      !ctx.permissions.has("EBD_CHAMADA_CORRIGIR")
    )
      throw new ApiError(
        403,
        "CHAMADA_FINALIZADA",
        "Somente usuários autorizados podem corrigir esta chamada.",
      );
    const records = Array.isArray(input.records) ? input.records : [],
      time = now(),
      statements: D1PreparedStatement[] = [];
    for (const value of records.slice(0, 1000)) {
      if (!value || typeof value !== "object") continue;
      const item = value as Record<string, unknown>,
        studentId = positive(item.studentId ?? item.personId),
        status = [
          "PRESENTE",
          "AUSENTE",
          "JUSTIFICADO",
          "NAO_INFORMADO",
        ].includes(String(item.status))
          ? String(item.status)
          : "NAO_INFORMADO";
      if (studentId)
        statements.push(
          database()
            .prepare(
              "INSERT INTO ebd_student_attendance(meeting_id,class_id,tenant_id,student_id,attendance_status,updated_by_user_id,updated_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ebd_student_enrollments WHERE class_id=? AND student_id=? AND tenant_id=? AND status='ATIVO') ON CONFLICT(meeting_id,class_id,student_id) DO UPDATE SET attendance_status=excluded.attendance_status,updated_by_user_id=excluded.updated_by_user_id,updated_at=excluded.updated_at",
            )
            .bind(
              meetingId,
              classId,
              tenant,
              studentId,
              status,
              ctx.session.user.id,
              time,
              classId,
              studentId,
              tenant,
            ),
        );
    }
    await database().batch(statements);
    return { message: "Rascunho salvo com segurança." };
  }
  if (action === "addVisitor") {
    if (!classId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a classe.");
    const visitorId = generatedId(),
      time = now(),
      personId = positive(input.personId);
    let name = clean(input.name, 160),
      phone = clean(input.phone, 30) || null;
    if (personId) {
      const person = await database()
        .prepare(
          "SELECT full_name,COALESCE(whatsapp,phone) phone FROM people WHERE id=? AND tenant_id=?",
        )
        .bind(personId, tenant)
        .first<{ full_name: string; phone: string | null }>();
      if (!person)
        throw new ApiError(
          404,
          "PESSOA_NAO_ENCONTRADA",
          "Pessoa não encontrada.",
        );
      name = person.full_name;
      phone = person.phone;
    }
    if (name.length < 2)
      throw new ApiError(
        400,
        "DADOS_INVALIDOS",
        "Informe o nome do visitante.",
      );
    await database().batch([
      database()
        .prepare(
          "INSERT INTO ebd_visitors(id,tenant_id,department_id,meeting_id,class_id,person_id,name,phone,age_range,invited_by,notes,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          visitorId,
          tenant,
          departmentId,
          meetingId,
          classId,
          personId,
          name,
          phone,
          clean(input.ageRange, 80) || null,
          clean(input.invitedBy, 160) || null,
          clean(input.notes, 500) || null,
          ctx.session.user.id,
          time,
        ),
      await auditStatements(
        ctx,
        "EBD_VISITANTE_REGISTRADO",
        "EBD_VISITOR",
        visitorId,
        null,
        { classId, name },
      ),
    ]);
    return { message: "Visitante adicionado." };
  }
  if (action === "finalizeClass") {
    if (!classId)
      throw new ApiError(400, "DADOS_INVALIDOS", "Selecione a classe.");
    const summary = await database()
      .prepare(
        "SELECT * FROM ebd_class_summaries WHERE meeting_id=? AND class_id=? AND tenant_id=?",
      )
      .bind(meetingId, classId, tenant)
      .first<Record<string, unknown>>();
    if (!summary)
      throw new ApiError(
        404,
        "CHAMADA_NAO_ENCONTRADA",
        "Chamada não encontrada.",
      );
    const expected = Number(input.version);
    if (expected !== Number(summary.version))
      throw new ApiError(
        409,
        "CHAMADA_ATUALIZADA",
        "Outra pessoa atualizou esta chamada. Recarregue antes de finalizar.",
      );
    if (
      summary.status === "FINALIZADA" &&
      !ctx.permissions.has("EBD_CHAMADA_CORRIGIR")
    )
      throw new ApiError(403, "CHAMADA_FINALIZADA", "Chamada já finalizada.");
    if (summary.status === "FINALIZADA" && clean(input.reason, 500).length < 3)
      throw new ApiError(
        400,
        "MOTIVO_OBRIGATORIO",
        "Informe o motivo da correção.",
      );
    const counts = await database()
      .prepare(
        "SELECT COUNT(*) enrolled,SUM(CASE WHEN COALESCE(a.attendance_status,'NAO_INFORMADO')='PRESENTE' THEN 1 ELSE 0 END) present,SUM(CASE WHEN COALESCE(a.attendance_status,'NAO_INFORMADO')='AUSENTE' THEN 1 ELSE 0 END) absent,SUM(CASE WHEN COALESCE(a.attendance_status,'NAO_INFORMADO')='JUSTIFICADO' THEN 1 ELSE 0 END) justified,SUM(CASE WHEN COALESCE(a.attendance_status,'NAO_INFORMADO')='NAO_INFORMADO' THEN 1 ELSE 0 END) pending FROM ebd_student_enrollments e LEFT JOIN ebd_student_attendance a ON a.meeting_id=? AND a.class_id=e.class_id AND a.student_id=e.student_id WHERE e.class_id=? AND e.tenant_id=? AND e.status='ATIVO'",
      )
      .bind(meetingId, classId, tenant)
      .first<{
        enrolled: number;
        present: number;
        absent: number;
        justified: number;
        pending: number;
      }>();
    if (Number(counts?.pending ?? 0) > 0)
      throw new ApiError(
        409,
        "CHAMADA_INCOMPLETA",
        `Ainda existem ${counts!.pending} alunos sem marcação.`,
      );
    const visitors = Number(
        (
          await database()
            .prepare(
              "SELECT COUNT(*) total FROM ebd_visitors WHERE meeting_id=? AND class_id=? AND tenant_id=?",
            )
            .bind(meetingId, classId, tenant)
            .first<{ total: number }>()
        )?.total ?? 0,
      ),
      time = now(),
      next = {
        enrolled: Number(counts?.enrolled ?? 0),
        present: Number(counts?.present ?? 0),
        absent: Number(counts?.absent ?? 0),
        justified: Number(counts?.justified ?? 0),
        visitors,
        bibles: Math.max(0, Number(input.bibleCount) || 0),
        assistance: Math.max(0, Number(input.assistanceCount) || 0),
        offering: Math.max(0, Math.round(Number(input.offeringCents) || 0)),
      },
      alerts = await departmentAbsenceAlerts(
        tenant,
        departmentId,
        ctx.department.absence_alert_threshold,
        classId,
      ),
      recipients = alerts.length
        ? await departmentRecipientIds(departmentId, tenant)
        : [];
    await database().batch([
      database()
        .prepare(
          "UPDATE ebd_class_summaries SET enrolled_count=?,present_count=?,absent_count=?,justified_count=?,visitor_count=?,bible_count=?,assistance_count=?,offering_cents=?,notes=?,status='FINALIZADA',version=version+1,finalized_by_user_id=?,finalized_at=?,updated_at=? WHERE meeting_id=? AND class_id=? AND tenant_id=? AND version=?",
        )
        .bind(
          next.enrolled,
          next.present,
          next.absent,
          next.justified,
          next.visitors,
          next.bibles,
          next.assistance,
          next.offering,
          clean(input.notes, 700) || null,
          ctx.session.user.id,
          time,
          time,
          meetingId,
          classId,
          tenant,
          expected,
        ),
      await auditStatements(
        ctx,
        summary.status === "FINALIZADA"
          ? "EBD_CHAMADA_CORRIGIDA"
          : "EBD_CHAMADA_FINALIZADA",
        "EBD_CLASS_SUMMARY",
        classId,
        summary,
        { ...next, absenceAlerts: alerts },
        clean(input.reason, 500) || null,
      ),
      ...notificationStatements({
        tenantId: tenant,
        departmentId,
        unitId: ctx.department.unit_id,
        type: "EBD_ALUNO_FALTAS_CONSECUTIVAS",
        title: "Atenção à frequência da EBD",
        message: `${alerts
          .slice(0, 3)
          .map((item) => item.fullName)
          .join(
            ", ",
          )}${alerts.length > 3 ? ` e mais ${alerts.length - 3}` : ""}: ${ctx.department.absence_alert_threshold} faltas consecutivas.`,
        route: `/painel/departamentos?abrir=${departmentId}&aba=relatorios`,
        userIds: alerts.length ? recipients : [],
      }),
    ]);
    return {
      message: alerts.length
        ? `Chamada finalizada. ${alerts.length} alerta(s) de faltas gerado(s).`
        : "Chamada finalizada.",
      alerts,
    };
  }
  if (action === "closeMeeting") {
    const all = await database()
        .prepare(
          "SELECT c.id,c.name,s.status FROM ebd_classes c LEFT JOIN ebd_class_summaries s ON s.class_id=c.id AND s.meeting_id=? WHERE c.tenant_id=? AND c.department_id=? AND c.status='ATIVO'",
        )
        .bind(meetingId, tenant, departmentId)
        .all<{ id: number; name: string; status: string | null }>(),
      pending = all.results.filter((row) => row.status !== "FINALIZADA"),
      reason = clean(input.exceptionReason, 700);
    if (pending.length && !reason)
      throw new ApiError(
        409,
        "CLASSES_PENDENTES",
        `Não é possível finalizar. Existem ${pending.length} classes pendentes.`,
      );
    const totals = await database()
        .prepare(
          "SELECT COALESCE(SUM(enrolled_count),0) enrolled,COALESCE(SUM(present_count),0) present,COALESCE(SUM(absent_count),0) absent,COALESCE(SUM(justified_count),0) justified,COALESCE(SUM(visitor_count),0) visitors,COALESCE(SUM(bible_count),0) bibles,COALESCE(SUM(assistance_count),0) assistance,COALESCE(SUM(offering_cents),0) offering FROM ebd_class_summaries WHERE meeting_id=? AND tenant_id=? AND status='FINALIZADA'",
        )
        .bind(meetingId, tenant)
        .first<Record<string, number>>(),
      time = now();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO ebd_closures(meeting_id,tenant_id,department_id,enrolled_total,present_total,absent_total,justified_total,visitor_total,bible_total,assistance_total,offering_total_cents,exception_reason,finalized_by_user_id,finalized_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(meeting_id) DO UPDATE SET enrolled_total=excluded.enrolled_total,present_total=excluded.present_total,absent_total=excluded.absent_total,justified_total=excluded.justified_total,visitor_total=excluded.visitor_total,bible_total=excluded.bible_total,assistance_total=excluded.assistance_total,offering_total_cents=excluded.offering_total_cents,exception_reason=excluded.exception_reason,finalized_by_user_id=excluded.finalized_by_user_id,finalized_at=excluded.finalized_at,updated_at=excluded.updated_at",
        )
        .bind(
          meetingId,
          tenant,
          departmentId,
          totals?.enrolled ?? 0,
          totals?.present ?? 0,
          totals?.absent ?? 0,
          totals?.justified ?? 0,
          totals?.visitors ?? 0,
          totals?.bibles ?? 0,
          totals?.assistance ?? 0,
          totals?.offering ?? 0,
          reason || null,
          ctx.session.user.id,
          time,
          time,
        ),
      database()
        .prepare(
          "UPDATE ebd_meetings SET status='FINALIZADO',version=version+1,finalized_by_user_id=?,finalized_at=?,updated_at=? WHERE id=? AND tenant_id=?",
        )
        .bind(ctx.session.user.id, time, time, meetingId, tenant),
      await auditStatements(
        ctx,
        "EBD_FECHAMENTO_FINALIZADO",
        "EBD_MEETING",
        meetingId,
        null,
        { ...totals, pending: pending.map((p) => p.name) },
        reason || null,
      ),
    ]);
    return { message: "EBD finalizada e totais calculados.", totals };
  }
  throw new ApiError(400, "ACAO_INVALIDA", "Ação da EBD inválida.");
}

export async function departmentReport(
  request: Request,
  id: number,
  query: Record<string, unknown>,
) {
  const required = (
      query.kind === "ebd" ? "EBD_RELATORIOS" : "DEPARTAMENTO_RELATORIOS"
    ) as PermissionCode,
    ctx = await departmentContext(request, id, required),
    tenant = ctx.session.user.tenantId,
    from = clean(query.from, 10) || "0000-01-01",
    to = clean(query.to, 10) || "9999-12-31";
  if (query.kind === "ebd") {
    const closures = await database()
      .prepare(
        "SELECT m.meeting_date,c.* FROM ebd_closures c JOIN ebd_meetings m ON m.id=c.meeting_id WHERE c.tenant_id=? AND c.department_id=? AND m.meeting_date BETWEEN ? AND ? ORDER BY m.meeting_date DESC LIMIT 366",
      )
      .bind(tenant, id, from, to)
      .all<Record<string, unknown>>();
    const students = await database()
        .prepare(
          "SELECT s.id,s.person_id,s.full_name,c.name class_name,COUNT(a.meeting_id) encounters,SUM(a.attendance_status='PRESENTE') present,SUM(a.attendance_status='AUSENTE') absent,SUM(a.attendance_status='JUSTIFICADO') justified,ROUND(100.0*SUM(a.attendance_status='PRESENTE')/NULLIF(COUNT(a.meeting_id),0),1) frequency FROM ebd_student_enrollments e JOIN ebd_students s ON s.id=e.student_id AND s.tenant_id=e.tenant_id JOIN ebd_classes c ON c.id=e.class_id AND c.tenant_id=e.tenant_id LEFT JOIN ebd_student_attendance a ON a.student_id=e.student_id AND a.class_id=e.class_id LEFT JOIN ebd_meetings m ON m.id=a.meeting_id AND m.meeting_date BETWEEN ? AND ? WHERE e.tenant_id=? AND e.department_id=? GROUP BY s.id,c.id ORDER BY s.full_name LIMIT 1000",
        )
        .bind(from, to, tenant, id)
        .all<Record<string, unknown>>(),
      absenceAlerts = await departmentAbsenceAlerts(
        tenant,
        id,
        ctx.department.absence_alert_threshold,
      ),
      unlinked = await database()
        .prepare(
          "SELECT s.id,s.full_name,s.birth_date,s.guardian_name,s.guardian_phone,c.name class_name,e.enrolled_at FROM ebd_students s LEFT JOIN ebd_student_enrollments e ON e.student_id=s.id AND e.tenant_id=s.tenant_id AND e.status='ATIVO' LEFT JOIN ebd_classes c ON c.id=e.class_id AND c.tenant_id=e.tenant_id WHERE s.tenant_id=? AND s.department_id=? AND s.person_id IS NULL AND s.status='ATIVO' ORDER BY s.full_name LIMIT 1000",
        )
        .bind(tenant, id)
        .all<Record<string, unknown>>();
    return {
      closures: closures.results,
      students: students.results,
      unlinkedStudents: unlinked.results,
      absenceAlerts,
      absenceAlertThreshold: ctx.department.absence_alert_threshold,
    };
  }
  const rows = await database()
    .prepare(
      "SELECT p.full_name,COUNT(a.activity_id) encounters,SUM(a.attendance_status='PRESENTE') present,SUM(a.attendance_status='AUSENTE') absent,SUM(a.attendance_status='JUSTIFICADO') justified,ROUND(100.0*SUM(a.attendance_status='PRESENTE')/NULLIF(COUNT(a.activity_id),0),1) frequency FROM department_participants dp JOIN people p ON p.id=dp.person_id AND p.tenant_id=dp.tenant_id LEFT JOIN department_attendance a ON a.person_id=dp.person_id AND a.department_id=dp.department_id LEFT JOIN department_activities x ON x.id=a.activity_id AND x.activity_date BETWEEN ? AND ? WHERE dp.tenant_id=? AND dp.department_id=? GROUP BY p.id ORDER BY p.full_name LIMIT 1000",
    )
    .bind(from, to, tenant, id)
    .all<Record<string, unknown>>();
  return { participants: rows.results };
}

import { requirePermission } from "@/lib/server/admin";
import { ApiError, database } from "@/lib/server/auth";
import type { AdministrativeSession } from "@/lib/types";
import {
  bytes,
  safeJson,
  toCsv,
  xlsx,
  zipStore,
  type ExportFileEntry,
} from "@/lib/export/formats";
import {
  canGenerateCompleteExport,
  exportScopeClause,
} from "@/lib/export/policy";

type ExportFormat = "xlsx" | "csv" | "json" | "zip";
type ExportKind =
  | "members"
  | "departments"
  | "secretary"
  | "full"
  | "technical";
type Row = Record<string, unknown>;
const dateName = () => new Date().toISOString().slice(0, 10);

const MEMBER_HEADERS = [
  "Código do Membro",
  "Nome Completo",
  "Nascimento",
  "Sexo",
  "CPF",
  "RG",
  "Título de Eleitor",
  "Telefone",
  "WhatsApp",
  "E-mail",
  "CEP",
  "Logradouro",
  "Número",
  "Complemento",
  "Bairro",
  "Cidade",
  "UF",
  "Matriz",
  "Filial",
  "Situação",
  "Função",
  "Entrada na Igreja",
  "Conversão",
  "Batismo",
  "Consagração",
  "Campos Personalizados",
  "ID da Pessoa",
  "ID da Matriz",
  "ID da Filial",
  "Criado em",
  "Atualizado em",
];
async function memberRows(
  session: AdministrativeSession,
  filters: Record<string, unknown> = {},
) {
  const scope = exportScopeClause(
      session.user.scope,
      session.user.boundMatrixId,
      session.user.boundBranchId,
      "p",
    ),
    where = ["p.tenant_id=?"],
    bindings: unknown[] = [session.user.tenantId, ...scope.bindings];
  if (scope.sql) where.push(scope.sql.replace(/^ AND /, ""));
  if (typeof filters.status === "string" && filters.status) {
    where.push("p.status=?");
    bindings.push(filters.status);
  }
  for (const [key, col] of [
    ["matrixId", "p.matrix_id"],
    ["branchId", "p.branch_id"],
  ] as const) {
    const n = Number(filters[key]);
    if (Number.isInteger(n) && n > 0) {
      where.push(`${col}=?`);
      bindings.push(n);
    }
  }
  if (typeof filters.search === "string" && filters.search.trim()) {
    const q = `%${filters.search.trim().slice(0, 120)}%`;
    where.push(
      "(p.full_name LIKE ? COLLATE NOCASE OR p.cpf LIKE ? OR p.rg LIKE ? COLLATE NOCASE OR p.voter_title LIKE ?)",
    );
    bindings.push(q, q, q, q);
  }
  const result = await database()
    .prepare(
      `SELECT p.*,m.name matrix_name,b.name branch_name,f.name function_name FROM people p JOIN organizational_units m ON m.id=p.matrix_id AND m.tenant_id=p.tenant_id LEFT JOIN organizational_units b ON b.id=p.branch_id AND b.tenant_id=p.tenant_id LEFT JOIN organizational_functions f ON f.id=p.primary_function_id AND f.tenant_id=p.tenant_id WHERE ${where.join(" AND ")} ORDER BY p.full_name COLLATE NOCASE`,
    )
    .bind(...bindings)
    .all<Record<string, unknown>>();
  const values = await database()
    .prepare(
      `SELECT v.person_id,f.name,v.value_text FROM member_custom_values v JOIN member_custom_fields f ON f.id=v.field_id AND f.tenant_id=v.tenant_id WHERE v.tenant_id=?`,
    )
    .bind(session.user.tenantId)
    .all<{ person_id: number; name: string; value_text: string }>();
  const custom = new Map<number, Record<string, string>>();
  for (const v of values.results) {
    const current = custom.get(v.person_id) ?? {};
    current[v.name] = v.value_text;
    custom.set(v.person_id, current);
  }
  return result.results.map((p) => ({
    "Código do Membro": String(p.member_number ?? "").padStart(6, "0"),
    "Nome Completo": p.full_name,
    Nascimento: p.birth_date,
    Sexo: p.sex,
    CPF: p.cpf,
    RG: p.rg,
    "Título de Eleitor": p.voter_title,
    Telefone: p.phone,
    WhatsApp: p.whatsapp,
    "E-mail": p.email,
    CEP: p.postal_code,
    Logradouro: p.street,
    Número: p.address_number,
    Complemento: p.complement,
    Bairro: p.district,
    Cidade: p.city,
    UF: p.state,
    Matriz: p.matrix_name,
    Filial: p.branch_name,
    Situação: p.status,
    Função: p.function_name,
    "Entrada na Igreja": p.church_entry_date,
    Conversão: p.conversion_date,
    Batismo: p.baptism_date,
    Consagração: p.consecration_date,
    "Campos Personalizados": custom.get(Number(p.id)) ?? {},
    "ID da Pessoa": p.id,
    "ID da Matriz": p.matrix_id,
    "ID da Filial": p.branch_id,
    "Criado em": p.created_at,
    "Atualizado em": p.updated_at,
  }));
}
async function genericRows(sql: string, bindings: unknown[] = []) {
  return (
    await database()
      .prepare(sql)
      .bind(...bindings)
      .all<Row>()
  ).results;
}
function response(
  data: Uint8Array | string,
  type: string,
  name: string,
  count: number,
) {
  const body =
    typeof data === "string"
      ? data
      : (data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer);
  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Export-Record-Count": String(count),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
async function audit(
  session: AdministrativeSession,
  kind: ExportKind,
  format: ExportFormat,
  count: number,
  status = "CONCLUIDA",
  details: string | null = null,
) {
  const scopeUnit =
      session.user.boundBranchId ??
      session.user.boundMatrixId ??
      session.user.conventionId,
    modules =
      kind === "members"
        ? "membros"
        : kind === "departments"
          ? "departamentos,participantes,ebd_classes,ebd_fechamentos"
          : kind === "secretary"
            ? "movimentacoes_eclesiasticas,documentos_emitidos"
          : "membros,usuarios,unidades,funcoes,historicos,campos_personalizados";
  await database()
    .prepare(
      "INSERT INTO data_export_audit(actor_user_id,actor_membership_id,tenant_id,export_type,modules,format,record_count,scope_unit_id,status,details,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      session.user.id,
      session.user.membershipId,
      session.user.tenantId,
      kind,
      modules,
      format.toUpperCase(),
      count,
      scopeUnit,
      status,
      details,
      new Date().toISOString(),
    )
    .run();
}

export async function exportData(
  request: Request,
  input: Record<string, unknown>,
) {
  const kind = (
    input.kind === "full" ||
    input.kind === "technical" ||
    input.kind === "departments" ||
    input.kind === "secretary"
      ? input.kind
      : "members"
  ) as ExportKind;
  const format = String(input.format ?? "xlsx").toLowerCase() as ExportFormat;
  if (!["xlsx", "csv", "json", "zip"].includes(format))
    throw new ApiError(
      400,
      "FORMATO_INVALIDO",
      "Formato de exportação inválido.",
    );
  if (input.confirmed !== true)
    throw new ApiError(
      400,
      "CONFIRMACAO_NECESSARIA",
      "Confirme a exportação dos dados pessoais.",
    );
  const required =
    kind === "members"
      ? "DADOS_EXPORTAR"
      : kind === "departments"
        ? "DEPARTAMENTO_RELATORIOS"
        : kind === "secretary"
          ? "SECRETARIA_RELATORIOS"
        : "DADOS_EXPORTAR_COMPLETO";
  const { session } = await requirePermission(request, required);
  if (
    kind !== "members" &&
    kind !== "departments" &&
    kind !== "secretary" &&
    !canGenerateCompleteExport(session.user.scope, session.user.isPlatformOwner)
  )
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "A exportação completa exige alcance de Convenção.",
    );
  if (kind === "technical" && !session.user.isPlatformOwner)
    throw new ApiError(
      403,
      "PERMISSAO_NEGADA",
      "O pacote técnico é exclusivo do proprietário da plataforma.",
    );
  const stamp = dateName();
  if (kind === "departments") {
    const scope =
      session.user.scope === "MATRIZ"
        ? { sql: " AND d.matrix_id=?", args: [session.user.boundMatrixId] }
        : session.user.scope === "FILIAL"
          ? { sql: " AND d.branch_id=?", args: [session.user.boundBranchId] }
          : {
              sql: " AND d.convention_id=?",
              args: [session.user.conventionId],
            };
    const rows = await genericRows(
      `SELECT d.name departamento,d.type,d.status,u.name unidade,(SELECT COUNT(*) FROM department_participants p WHERE p.department_id=d.id AND p.status='ATIVO') participantes,(SELECT COUNT(*) FROM ebd_classes c WHERE c.department_id=d.id AND c.status='ATIVO') classes,(SELECT COALESCE(SUM(f.present_total),0) FROM ebd_closures f WHERE f.department_id=d.id) presencas_ebd,(SELECT COALESCE(SUM(f.visitor_total),0) FROM ebd_closures f WHERE f.department_id=d.id) visitantes_ebd,(SELECT COALESCE(SUM(f.offering_total_cents),0) FROM ebd_closures f WHERE f.department_id=d.id) ofertas_centavos FROM departments d JOIN organizational_units u ON u.id=d.unit_id AND u.tenant_id=d.tenant_id WHERE d.tenant_id=?${scope.sql} ORDER BY d.name`,
      [session.user.tenantId, ...scope.args],
    );
    const headers = Object.keys(rows[0] ?? {});
    await audit(session, kind, format, rows.length);
    if (format === "csv")
      return response(
        toCsv(rows, headers),
        "text/csv; charset=utf-8",
        `departamentos_ebd_${stamp}.csv`,
        rows.length,
      );
    if (format === "json")
      return response(
        safeJson({
          export_schema_version: "1.0",
          generated_at: new Date().toISOString(),
          records: rows,
        }),
        "application/json; charset=utf-8",
        `departamentos_ebd_${stamp}.json`,
        rows.length,
      );
    if (format !== "xlsx")
      throw new ApiError(
        400,
        "FORMATO_INVALIDO",
        "Use Excel, CSV ou JSON para exportar Departamentos e EBD.",
      );
    return response(
      xlsx(rows, headers),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `departamentos_ebd_${stamp}.xlsx`,
      rows.length,
    );
  }
  if (kind === "secretary") {
    const scope = exportScopeClause(
      session.user.scope,
      session.user.boundMatrixId,
      session.user.boundBranchId,
      "p",
    );
    const rows = await genericRows(
      `SELECT m.effective_date data,p.full_name pessoa,printf('%06d',p.member_number) codigo,m.movement_type tipo,u.name unidade,m.description descricao,m.status,m.created_at registrado_em FROM church_movements m JOIN people p ON p.id=m.person_id AND p.tenant_id=m.tenant_id JOIN organizational_units u ON u.id=m.unit_id AND u.tenant_id=m.tenant_id WHERE m.tenant_id=?${scope.sql} UNION ALL SELECT substr(d.issued_at,1,10),p.full_name,printf('%06d',p.member_number),'DOCUMENTO_'||d.document_type,u.name,d.document_number,'EMITIDO',d.issued_at FROM secretary_documents d JOIN people p ON p.id=d.person_id AND p.tenant_id=d.tenant_id JOIN organizational_units u ON u.id=d.unit_id AND u.tenant_id=d.tenant_id WHERE d.tenant_id=?${scope.sql} ORDER BY data DESC,registrado_em DESC`,
      [
        session.user.tenantId,
        ...scope.bindings,
        session.user.tenantId,
        ...scope.bindings,
      ],
    );
    const headers = Object.keys(rows[0] ?? {});
    await audit(session, kind, format, rows.length);
    if (format === "csv")
      return response(
        toCsv(rows, headers),
        "text/csv; charset=utf-8",
        `secretaria_eclesiastica_${stamp}.csv`,
        rows.length,
      );
    if (format === "json")
      return response(
        safeJson({
          export_schema_version: "1.0",
          generated_at: new Date().toISOString(),
          records: rows,
        }),
        "application/json; charset=utf-8",
        `secretaria_eclesiastica_${stamp}.json`,
        rows.length,
      );
    if (format !== "xlsx")
      throw new ApiError(
        400,
        "FORMATO_INVALIDO",
        "Use Excel, CSV ou JSON para exportar a Secretaria.",
      );
    return response(
      xlsx(rows, headers),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `secretaria_eclesiastica_${stamp}.xlsx`,
      rows.length,
    );
  }
  const members = await memberRows(
    session,
    (input.filters && typeof input.filters === "object"
      ? input.filters
      : {}) as Record<string, unknown>,
  );
  if (kind === "members") {
    await audit(session, kind, format, members.length);
    if (format === "csv")
      return response(
        toCsv(members, MEMBER_HEADERS),
        "text/csv; charset=utf-8",
        `membros_${stamp}.csv`,
        members.length,
      );
    if (format === "json")
      return response(
        safeJson({
          export_schema_version: "1.0",
          generated_at: new Date().toISOString(),
          records: members,
        }),
        "application/json; charset=utf-8",
        `membros_${stamp}.json`,
        members.length,
      );
    if (format !== "xlsx")
      throw new ApiError(
        400,
        "FORMATO_INVALIDO",
        "Use Excel, CSV ou JSON para exportar membros.",
      );
    return response(
      xlsx(members, MEMBER_HEADERS),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `membros_${stamp}.xlsx`,
      members.length,
    );
  }
  if (format !== "zip")
    throw new ApiError(
      400,
      "FORMATO_INVALIDO",
      "A exportação completa utiliza o formato ZIP.",
    );
  const tenant = (await database()
    .prepare(
      "SELECT id,name,slug,status,created_at,updated_at FROM tenants WHERE id=?",
    )
    .bind(session.user.tenantId)
    .first<Row>())!;
  const units = await genericRows(
    "SELECT id,tenant_id,type,name,code,parent_id,status,cnpj,phone,email,city,state,created_at,updated_at FROM organizational_units WHERE tenant_id=? ORDER BY type,name",
    [session.user.tenantId],
  );
  const users = await genericRows(
    "SELECT m.id membership_id,m.user_id,m.tenant_id,m.display_name,u.username,u.email,u.cpf,m.role_name,m.scope,m.scope_unit_id,m.status,m.created_at,m.updated_at FROM tenant_memberships m JOIN auth_users u ON u.id=m.user_id WHERE m.tenant_id=? ORDER BY m.display_name",
    [session.user.tenantId],
  );
  const functions = await genericRows(
    "SELECT id,tenant_id,name,description,status,created_at,updated_at FROM organizational_functions WHERE tenant_id=? ORDER BY name",
    [session.user.tenantId],
  );
  const histories = await genericRows(
    "SELECT id,tenant_id,person_id,event_type,description,event_date,actor_user_id,created_at FROM person_history WHERE tenant_id=? ORDER BY created_at",
    [session.user.tenantId],
  );
  const fields = await genericRows(
    "SELECT id,tenant_id,name,field_type,help_text,required,status,display_order,section_name,show_admin,show_public,show_print,options_json,created_at,updated_at FROM member_custom_fields WHERE tenant_id=? ORDER BY display_order,name",
    [session.user.tenantId],
  );
  const values = await genericRows(
    "SELECT person_id,tenant_id,field_id,value_text,created_at,updated_at FROM member_custom_values WHERE tenant_id=? ORDER BY person_id,field_id",
    [session.user.tenantId],
  );
  const manifest = {
    product: "NexIgreja",
    system_version: "0.2.0",
    export_schema_version: "1.0",
    tenant,
    generated_at: new Date().toISOString(),
    timezone: "America/Belem",
    export_type: kind,
    modules: [
      "membros",
      "usuarios",
      "unidades",
      "funcoes",
      "historicos",
      "campos_personalizados",
    ],
    counts: {
      membros: members.length,
      usuarios: users.length,
      unidades: units.length,
      funcoes: functions.length,
      historicos: histories.length,
      campos_personalizados: fields.length,
      valores_personalizados: values.length,
    },
    formats: ["json", "csv"],
    excluded_sensitive_data: [
      "password_hash",
      "sessions",
      "tokens",
      "cookies",
      "api_keys",
      "secrets",
    ],
  };
  const entries: ExportFileEntry[] = [
    { name: "manifest.json", data: bytes(safeJson(manifest)) },
    { name: "membros.json", data: bytes(safeJson(members)) },
    { name: "membros.csv", data: bytes(toCsv(members, MEMBER_HEADERS)) },
    {
      name: "usuarios.csv",
      data: bytes(toCsv(users, Object.keys(users[0] ?? {}))),
    },
    {
      name: "unidades.csv",
      data: bytes(toCsv(units, Object.keys(units[0] ?? {}))),
    },
    {
      name: "funcoes.csv",
      data: bytes(toCsv(functions, Object.keys(functions[0] ?? {}))),
    },
    { name: "historicos.json", data: bytes(safeJson(histories)) },
    {
      name: "campos_personalizados.json",
      data: bytes(safeJson({ definitions: fields, values })),
    },
    {
      name: "README.txt",
      data: bytes(
        "Pacote de portabilidade NexIgreja. Schema 1.0. Arquivos UTF-8. Senhas, sessões, tokens e segredos não são exportados.",
      ),
    },
  ];
  const photos = await database()
    .prepare(
      "SELECT person_id,image_data,mime_type FROM member_photos WHERE tenant_id=?",
    )
    .bind(session.user.tenantId)
    .all<{ person_id: number; image_data: ArrayBuffer; mime_type: string }>();
  for (const photo of photos.results) {
    const ext =
      photo.mime_type === "image/png"
        ? "png"
        : photo.mime_type === "image/webp"
          ? "webp"
          : "jpg";
    entries.push({
      name: `files/membros/${photo.person_id}.${ext}`,
      data: new Uint8Array(photo.image_data),
    });
  }
  const total =
    members.length +
    users.length +
    units.length +
    functions.length +
    histories.length +
    fields.length +
    values.length;
  await audit(session, kind, format, total);
  return response(
    zipStore(entries),
    "application/zip",
    `nexigreja_backup_portabilidade_${stamp}.zip`,
    total,
  );
}

export async function exportHistory(request: Request) {
  const { session } = await requirePermission(request, "DADOS_EXPORTAR");
  let sql =
    "SELECT e.id,e.export_type,e.modules,e.format,e.record_count,e.status,e.created_at,u.name actor_name FROM data_export_audit e JOIN auth_users u ON u.id=e.actor_user_id WHERE e.tenant_id=?";
  const bindings: unknown[] = [session.user.tenantId];
  if (session.user.scope !== "CONVENCAO") {
    sql += " AND e.actor_membership_id=?";
    bindings.push(session.user.membershipId);
  }
  sql += " ORDER BY e.created_at DESC LIMIT 50";
  return (
    await database()
      .prepare(sql)
      .bind(...bindings)
      .all<Row>()
  ).results;
}

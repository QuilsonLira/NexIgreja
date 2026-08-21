import { ApiError, database } from "@/lib/server/auth";
import { generatedId, requirePermission } from "@/lib/server/admin";
import type { AdministrativeSession } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";

type Input = Record<string, unknown>;
type Ctx = { session: AdministrativeSession; permissions: Set<PermissionCode> };
type Unit = { id: number; type: string; parent_id: number | null };
type Repass = {
  id: number;
  tenant_id: number;
  period_id: number;
  source_unit_id: number;
  destination_unit_id: number;
  destination_department_id: number | null;
  payer_unit_id: number;
  receiver_unit_id: number;
  recipient_name: string;
  competency: string;
  expected_cents: number;
  sent_cents: number;
  received_cents: number;
  written_off_cents: number;
  status: string;
  kind: string;
};
type PreparedStatement = ReturnType<ReturnType<typeof database>["prepare"]>;
type ClosureRule = Record<string, unknown>;
type ClosureResult = { financialDestination: string; calculatedAmountCents: number; displayOrder: number; recipientName: string };
const now = () => new Date().toISOString();
const clean = (value: unknown, max = 800) =>
  typeof value === "string"
    ? value.trim().replace(/[<>]/g, "").slice(0, max)
    : "";
const positive = (value: unknown) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0)
    throw new ApiError(400, "DADOS_INVALIDOS", "Registro inválido.");
  return n;
};
const amount = (value: unknown) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new ApiError(400, "VALOR_INVALIDO", "Informe um valor positivo.");
  return n;
};
const date = (value: unknown) => {
  const result = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result))
    throw new ApiError(400, "DATA_INVALIDA", "Informe uma data válida.");
  return result;
};

export async function prepareClosureRepasses(input: { tenantId: number; userId: number; periodId: number; sourceUnitId: number; competency: string; closureVersion: number; stamp: string; rules: ClosureRule[]; results: ClosureResult[] }) {
  const previous = await database().prepare("SELECT * FROM finance_interunit_repasses WHERE tenant_id=? AND period_id=? AND status<>'SUBSTITUIDO' ORDER BY closure_version,id").bind(input.tenantId,input.periodId).all<Record<string,unknown>>();
  const statements:PreparedStatement[]=[];
  const generated:Array<{id:number;receiverUnitId:number;amountCents:number}>=[];
  for(const result of input.results){
    if(result.financialDestination!=="REPASSAR"||result.calculatedAmountCents<=0)continue;
    const rule=input.rules.find(row=>Number(row.display_order)===result.displayOrder),destinationUnitId=Number(rule?.destination_unit_id||0);
    if(!destinationUnitId)continue;
    const related=previous.results.filter(row=>Number(row.rule_display_order)===result.displayOrder&&Number(row.destination_unit_id)===destinationUnitId),untouched=related.filter(row=>Number(row.sent_cents||0)===0&&Number(row.received_cents||0)===0&&Number(row.written_off_cents||0)===0),preserved=related.filter(row=>!untouched.includes(row));
    const baseline=preserved.reduce((sum,row)=>sum+(row.kind==="AJUSTE_DEVOLUCAO"?-1:1)*Number(row.expected_cents||0),0),delta=result.calculatedAmountCents-baseline;
    if(delta===0){for(const row of untouched)statements.push(database().prepare("UPDATE finance_interunit_repasses SET status='SUBSTITUIDO',updated_at=? WHERE id=? AND tenant_id=? AND status<>'SUBSTITUIDO'").bind(input.stamp,row.id,input.tenantId));continue;}
    const id=generatedId(),kind=delta<0?"AJUSTE_DEVOLUCAO":baseline>0?"AJUSTE_COMPLEMENTAR":"NORMAL",payerUnitId=delta<0?destinationUnitId:input.sourceUnitId,receiverUnitId=delta<0?input.sourceUnitId:destinationUnitId,expected=Math.abs(delta);
    statements.push(database().prepare("INSERT INTO finance_interunit_repasses(id,tenant_id,period_id,closure_version,rule_display_order,source_rule_id,source_unit_id,destination_unit_id,destination_department_id,kind,payer_unit_id,receiver_unit_id,recipient_name,competency,expected_cents,status,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDENTE',?,?,?)").bind(id,input.tenantId,input.periodId,input.closureVersion,result.displayOrder,rule?.source_rule_id??null,input.sourceUnitId,destinationUnitId,rule?.destination_department_id??null,kind,payerUnitId,receiverUnitId,result.recipientName,input.competency,expected,input.userId,input.stamp,input.stamp));
    for(const row of untouched)statements.push(database().prepare("UPDATE finance_interunit_repasses SET status='SUBSTITUIDO',superseded_by_id=?,updated_at=? WHERE id=? AND tenant_id=? AND status<>'SUBSTITUIDO'").bind(id,input.stamp,row.id,input.tenantId));
    generated.push({id,receiverUnitId,amountCents:expected});
  }
  return{statements,generated};
}
async function context(
  request: Request,
  permission: PermissionCode,
): Promise<Ctx> {
  const result = await requirePermission(request, permission);
  return { session: result.session, permissions: result.permissions };
}
async function unit(ctx: Ctx, id: number) {
  const row = await database()
    .prepare(
      "SELECT id,type,parent_id FROM organizational_units WHERE id=? AND tenant_id=? AND status='ATIVO' AND archived_at IS NULL",
    )
    .bind(id, ctx.session.user.tenantId)
    .first<Unit>();
  if (!row)
    throw new ApiError(
      404,
      "UNIDADE_NAO_ENCONTRADA",
      "Unidade não encontrada.",
    );
  return row;
}
function canAccess(ctx: Ctx, row: Unit) {
  return row.id === ctx.session.activeContext?.unitId;
}
async function requireUnitAccess(ctx: Ctx, id: number) {
  const row = await unit(ctx, id);
  if (!canAccess(ctx, row))
    throw new ApiError(
      403,
      "FORA_DO_ESCOPO",
      "Este repasse não pertence ao seu escopo.",
    );
  return row;
}
async function repass(ctx: Ctx, id: number) {
  const row = await database()
    .prepare(
      "SELECT * FROM finance_interunit_repasses WHERE id=? AND tenant_id=?",
    )
    .bind(id, ctx.session.user.tenantId)
    .first<Repass>();
  if (!row)
    throw new ApiError(
      404,
      "REPASSE_NAO_ENCONTRADO",
      "Repasse não encontrado.",
    );
  return row;
}
function status(row: {
  expected_cents: number;
  sent_cents: number;
  received_cents: number;
  written_off_cents: number;
}) {
  if (row.received_cents + row.written_off_cents >= row.expected_cents)
    return "QUITADO";
  if (row.sent_cents > row.received_cents)
    return row.received_cents > 0 ? "DIVERGENCIA" : "ENVIADO";
  if (row.sent_cents || row.received_cents || row.written_off_cents)
    return "PARCIAL";
  return "PENDENTE";
}
function audit(
  ctx: Ctx,
  action: string,
  row: Repass,
  next: unknown,
  reason: string | null = null,
) {
  return database()
    .prepare(
      "INSERT INTO finance_audit(tenant_id,unit_id,actor_user_id,actor_membership_id,action,entity_type,entity_id,previous_values,new_values,reason,created_at) VALUES(?,?,?,?,?,'REPASSE_ENTRE_UNIDADES',?,?,?,?,?)",
    )
    .bind(
      ctx.session.user.tenantId,
      row.source_unit_id,
      ctx.session.user.id,
      ctx.session.user.membershipId,
      action,
      row.id,
      JSON.stringify(row),
      JSON.stringify(next),
      reason,
      now(),
    );
}
function visibility(ctx: Ctx) {
  const unitId=ctx.session.activeContext?.unitId;
  return {sql:"(r.payer_unit_id=? OR r.receiver_unit_id=?)",args:[unitId,unitId]};
}

export async function financeRepasses(request: Request) {
  const ctx = await context(request, "FINANCEIRO_VISUALIZAR"),
    scope = visibility(ctx),
    rows = await database()
      .prepare(
        `SELECT r.*,su.name source_unit_name,du.name destination_unit_name,pu.name payer_unit_name,ru.name receiver_unit_name,d.name destination_department_name,p.status period_status FROM finance_interunit_repasses r JOIN organizational_units su ON su.id=r.source_unit_id AND su.tenant_id=r.tenant_id JOIN organizational_units du ON du.id=r.destination_unit_id AND du.tenant_id=r.tenant_id JOIN organizational_units pu ON pu.id=r.payer_unit_id AND pu.tenant_id=r.tenant_id JOIN organizational_units ru ON ru.id=r.receiver_unit_id AND ru.tenant_id=r.tenant_id JOIN finance_periods p ON p.id=r.period_id AND p.tenant_id=r.tenant_id LEFT JOIN departments d ON d.id=r.destination_department_id AND d.tenant_id=r.tenant_id WHERE r.tenant_id=? AND ${scope.sql} ORDER BY CASE r.status WHEN 'DIVERGENCIA' THEN 0 WHEN 'PENDENTE' THEN 1 WHEN 'ENVIADO' THEN 2 WHEN 'PARCIAL' THEN 3 WHEN 'QUITADO' THEN 4 ELSE 5 END,r.created_at DESC LIMIT 250`,
      )
      .bind(ctx.session.user.tenantId, ...scope.args)
      .all<Record<string, unknown>>(),
    events = rows.results.length
      ? await database()
          .prepare(
            `SELECT e.*,a.name account_name,u.name actor_name FROM finance_interunit_repass_events e LEFT JOIN finance_accounts a ON a.id=e.account_id AND a.tenant_id=e.tenant_id JOIN auth_users u ON u.id=e.actor_user_id WHERE e.tenant_id=? AND e.repass_id IN (${rows.results.map(() => "?").join(",")}) ORDER BY e.created_at DESC`,
          )
          .bind(ctx.session.user.tenantId, ...rows.results.map((row) => row.id))
          .all<Record<string, unknown>>()
      : { results: [] as Record<string, unknown>[] },
    accounts = await database()
      .prepare(
        "SELECT a.id,a.unit_id,a.name,a.account_type,a.status,u.type unit_type,u.parent_id unit_parent_id FROM finance_accounts a JOIN organizational_units u ON u.id=a.unit_id AND u.tenant_id=a.tenant_id WHERE a.tenant_id=? AND a.unit_id=? AND a.status='ATIVA' AND u.status='ATIVO' AND u.archived_at IS NULL",
      )
      .bind(ctx.session.user.tenantId,ctx.session.activeContext?.unitId)
      .all<Record<string, unknown>>();
  const eventMap = new Map<number, Record<string, unknown>[]>();
  for (const event of events.results) {
    const id = Number(event.repass_id),
      list = eventMap.get(id) || [];
    list.push(event);
    eventMap.set(id, list);
  }
  return {
    repasses: await Promise.all(
      rows.results.map(async (row) => {
        const payer = await unit(ctx, Number(row.payer_unit_id)),
          receiver = await unit(ctx, Number(row.receiver_unit_id));
        return {
          ...row,
          pending_cents: Math.max(
            0,
            Number(row.expected_cents) -
              Number(row.received_cents) -
              Number(row.written_off_cents),
          ),
          in_transit_cents: Math.max(
            0,
            Number(row.sent_cents) - Number(row.received_cents),
          ),
          events: eventMap.get(Number(row.id)) || [],
          canSend:
            row.status !== "SUBSTITUIDO" &&
            ctx.permissions.has("FINANCEIRO_TRANSFERENCIAS_GERENCIAR") &&
            canAccess(ctx, payer) &&
            Number(row.sent_cents) + Number(row.written_off_cents) <
              Number(row.expected_cents),
          canReceive:
            row.status !== "SUBSTITUIDO" &&
            ctx.permissions.has("FINANCEIRO_TRANSFERENCIAS_GERENCIAR") &&
            canAccess(ctx, receiver) &&
            Number(row.received_cents) < Number(row.sent_cents),
          canWriteOff:
            row.status !== "SUBSTITUIDO" &&
            ctx.session.user.scope !== "FILIAL" &&
            ctx.permissions.has("FINANCEIRO_CONFIGURAR") &&
            canAccess(ctx, receiver) &&
            Number(row.sent_cents) + Number(row.written_off_cents) <
              Number(row.expected_cents),
        };
      }),
    ),
    accounts: accounts.results.filter(
      (account) =>
        canAccess(ctx, {
          id: Number(account.unit_id),
          type: String(account.unit_type),
          parent_id: Number(account.unit_parent_id) || null,
        }) &&
        rows.results.some(
          (row) =>
            Number(row.payer_unit_id) === Number(account.unit_id) ||
            Number(row.receiver_unit_id) === Number(account.unit_id),
        ),
    ),
  };
}

export async function financeRepassOperation(request: Request, input: Input) {
  const action = clean(input.action, 30).toUpperCase();
  if (!(["SEND", "RECEIVE", "WRITE_OFF"] as string[]).includes(action))
    throw new ApiError(
      400,
      "OPERACAO_INVALIDA",
      "Operação de repasse inválida.",
    );
  const ctx = await context(
      request,
      action === "WRITE_OFF"
        ? "FINANCEIRO_CONFIGURAR"
        : "FINANCEIRO_TRANSFERENCIAS_GERENCIAR",
    ),
    row = await repass(ctx, positive(input.repassId));
  if (row.status === "SUBSTITUIDO")
    throw new ApiError(
      409,
      "REPASSE_SUBSTITUIDO",
      "Este repasse foi substituído por um novo fechamento.",
    );
  const cents = amount(input.amountCents),
    occurredOn = date(
      input.occurredOn || new Date().toISOString().slice(0, 10),
    ),
    reason = clean(input.reason, 800),
    stamp = now();
  if (action === "WRITE_OFF") {
    await requireUnitAccess(ctx, row.receiver_unit_id);
    if (ctx.session.user.scope === "FILIAL")
      throw new ApiError(
        403,
        "REGULARIZACAO_NEGADA",
        "A regularização deve ser autorizada pela Matriz ou Convenção responsável.",
      );
    const available =
      row.expected_cents - row.sent_cents - row.written_off_cents;
    if (cents > available)
      throw new ApiError(
        409,
        "VALOR_EXCEDE_PENDENCIA",
        "A regularização não pode atingir valor já enviado.",
      );
    if (reason.length < 10)
      throw new ApiError(
        400,
        "MOTIVO_OBRIGATORIO",
        "Explique a destinação autorizada da diferença.",
      );
    const next = { ...row, written_off_cents: row.written_off_cents + cents },
      nextStatus = status(next),
      eventId = generatedId();
    await database().batch([
      database()
        .prepare(
          "INSERT INTO finance_interunit_repass_events(id,tenant_id,repass_id,event_type,amount_cents,occurred_on,reason,actor_user_id,created_at) VALUES(?,?,?,'REGULARIZACAO',?,?,?,?,?)",
        )
        .bind(
          eventId,
          ctx.session.user.tenantId,
          row.id,
          cents,
          occurredOn,
          reason,
          ctx.session.user.id,
          stamp,
        ),
      database()
        .prepare(
          "UPDATE finance_interunit_repasses SET written_off_cents=written_off_cents+?,status=?,updated_at=? WHERE id=? AND tenant_id=? AND written_off_cents=?",
        )
        .bind(
          cents,
          nextStatus,
          stamp,
          row.id,
          ctx.session.user.tenantId,
          row.written_off_cents,
        ),
      audit(
        ctx,
        "REGULARIZAR_DIFERENCA",
        row,
        { amountCents: cents, status: nextStatus },
        reason,
      ),
    ]);
    await notify(
      ctx,
      row.payer_unit_id,
      "Diferença de repasse regularizada",
      `${reason} Valor: ${(cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      row.id,
    );
    return { id: row.id, status: nextStatus };
  }
  const sideUnitId =
    action === "SEND" ? row.payer_unit_id : row.receiver_unit_id;
  await requireUnitAccess(ctx, sideUnitId);
  const accountId = positive(input.accountId),
    account = await database()
      .prepare(
        "SELECT id,unit_id,status FROM finance_accounts WHERE id=? AND tenant_id=?",
      )
      .bind(accountId, ctx.session.user.tenantId)
      .first<{ id: number; unit_id: number; status: string }>();
  if (!account || account.status !== "ATIVA" || account.unit_id !== sideUnitId)
    throw new ApiError(
      400,
      "CONTA_INVALIDA",
      "Selecione uma conta ativa da unidade responsável.",
    );
  const limit =
    action === "SEND"
      ? row.expected_cents - row.sent_cents - row.written_off_cents
      : row.sent_cents - row.received_cents;
  if (cents > limit)
    throw new ApiError(
      409,
      "VALOR_EXCEDE_PENDENCIA",
      action === "SEND"
        ? "O envio excede o saldo ainda não repassado."
        : "O recebimento excede o valor informado como enviado.",
    );
  const openPeriod = await database()
      .prepare(
        "SELECT id,competency FROM finance_periods WHERE tenant_id=? AND unit_id=? AND status='ABERTO' ORDER BY COALESCE(reopened_at,opened_at) DESC LIMIT 1",
      )
      .bind(ctx.session.user.tenantId, sideUnitId)
      .first<{ id: number; competency: string }>(),
    movementId = generatedId(),
    eventId = generatedId(),
    direction = action === "SEND" ? "SAIDA" : "ENTRADA",
    eventType = action === "SEND" ? "ENVIO" : "RECEBIMENTO",
    description = `${action === "SEND" ? "Repasse enviado para" : "Repasse recebido de"} ${action === "SEND" ? row.receiver_unit_id : row.payer_unit_id} · ${row.recipient_name}`,
    idempotency = `repass:${row.id}:${eventType}:${eventId}`,
    next = {
      ...row,
      sent_cents: row.sent_cents + (action === "SEND" ? cents : 0),
      received_cents: row.received_cents + (action === "RECEIVE" ? cents : 0),
    },
    nextStatus = status(next);
  await database().batch([
    database()
      .prepare(
        "INSERT INTO finance_movements(id,tenant_id,unit_id,account_id,direction,amount_cents,occurred_on,competency,description,category_id,payment_method_id,cost_center_id,department_id,campaign_id,fund_id,source,source_entity,source_entity_id,privacy,idempotency_key,created_by_user_id,created_at,period_id,created_during_reopening,updated_at) VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,?,NULL,NULL,'OUTRO','REPASSE_ENTRE_UNIDADES',?,'IDENTIFICADA_PRIVADA',?,?,?,?,0,?)",
      )
      .bind(
        movementId,
        ctx.session.user.tenantId,
        sideUnitId,
        accountId,
        direction,
        cents,
        occurredOn,
        openPeriod?.competency || row.competency,
        description,
        action === "RECEIVE" ? row.destination_department_id : null,
        row.id,
        idempotency,
        ctx.session.user.id,
        stamp,
        openPeriod?.id ?? null,
        stamp,
      ),
    database()
      .prepare(
        "INSERT INTO finance_interunit_repass_events(id,tenant_id,repass_id,event_type,amount_cents,account_id,movement_id,occurred_on,reason,actor_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        eventId,
        ctx.session.user.tenantId,
        row.id,
        eventType,
        cents,
        accountId,
        movementId,
        occurredOn,
        reason || null,
        ctx.session.user.id,
        stamp,
      ),
    database()
      .prepare(
        `UPDATE finance_interunit_repasses SET ${action === "SEND" ? "sent_cents=sent_cents+?" : "received_cents=received_cents+?"},status=?,updated_at=? WHERE id=? AND tenant_id=? AND ${action === "SEND" ? "sent_cents" : "received_cents"}=?`,
      )
      .bind(
        cents,
        nextStatus,
        stamp,
        row.id,
        ctx.session.user.tenantId,
        action === "SEND" ? row.sent_cents : row.received_cents,
      ),
    audit(
      ctx,
      action === "SEND" ? "ENVIAR_REPASSE" : "CONFIRMAR_RECEBIMENTO",
      row,
      { amountCents: cents, movementId, status: nextStatus },
      reason || null,
    ),
  ]);
  await notify(
    ctx,
    action === "SEND" ? row.receiver_unit_id : row.payer_unit_id,
    action === "SEND" ? "Repasse enviado" : "Recebimento confirmado",
    `${row.recipient_name}: ${(cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    row.id,
  );
  return {
    id: row.id,
    status: nextStatus,
    movementId,
    linkedToOpenPeriod: Boolean(openPeriod),
  };
}

async function notify(
  ctx: Ctx,
  unitId: number,
  title: string,
  message: string,
  repassId: number,
) {
  const target = await unit(ctx, unitId),
    recipients = await database()
      .prepare(
        "SELECT DISTINCT m.user_id FROM tenant_memberships m JOIN membership_permissions p ON p.membership_id=m.id WHERE m.tenant_id=? AND m.status='ATIVO' AND m.archived_at IS NULL AND p.permission='FINANCEIRO_VISUALIZAR' AND (m.scope='CONVENCAO' OR (m.scope='MATRIZ' AND (m.scope_unit_id=? OR ? IN (SELECT id FROM organizational_units WHERE parent_id=m.scope_unit_id AND tenant_id=m.tenant_id))) OR (m.scope='FILIAL' AND m.scope_unit_id=?))",
      )
      .bind(
        ctx.session.user.tenantId,
        target.type === "MATRIZ" ? target.id : target.parent_id,
        unitId,
        unitId,
      )
      .all<{ user_id: number }>();
  if (!recipients.results.length) return;
  const id = generatedId(),
    stamp = now();
  await database().batch([
    database()
      .prepare(
        "INSERT INTO notifications(id,tenant_id,audience,type,title,message,priority,internal_route,source_entity,source_entity_id,unit_id,group_key,metadata_json,mandatory,created_at,updated_at) VALUES(?,?,'ORGANIZATIONAL','FINANCEIRO_REPASSE',?,?,'IMPORTANTE','/painel/financeiro?aba=repasses','FINANCE_INTERUNIT_REPASS',?,?,?,'{}',0,?,?)",
      )
      .bind(
        id,
        ctx.session.user.tenantId,
        title,
        message,
        repassId,
        unitId,
        `FINANCEIRO_REPASSE:${repassId}:${stamp}`,
        stamp,
        stamp,
      ),
    ...recipients.results.map((item) =>
      database()
        .prepare(
          "INSERT OR IGNORE INTO notification_recipients(notification_id,user_id,created_at) VALUES(?,?,?)",
        )
        .bind(id, item.user_id, stamp),
    ),
  ]);
}

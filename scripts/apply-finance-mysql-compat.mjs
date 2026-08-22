import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const financePath = path.join(process.cwd(), "lib", "server", "finance.ts");
const periodsPath = path.join(process.cwd(), "lib", "server", "finance-periods.ts");
const reportsPath = path.join(process.cwd(), "lib", "server", "finance-reports.ts");
const quickComponentPath = path.join(process.cwd(), "components", "finance-quick-entry.tsx");

async function read(file) {
  return readFile(file, "utf8");
}

async function saveIfChanged(file, before, after, label) {
  if (before === after) {
    console.log(`${label}: already synchronized`);
    return;
  }
  await writeFile(file, after, "utf8");
  console.log(`${label}: applied`);
}

function replaceRequired(source, current, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(current)) throw new Error(`${label} anchor not found`);
  return source.replace(current, replacement);
}

// MySQL does not allow an aggregate SELECT alias to be referenced inside
// another expression in ORDER BY (ER_ILLEGAL_REFERENCE / group function).
// SQLite accepts this form, so normalize only the problematic ordering while
// preserving the same business rule: next open installment first, otherwise
// fall back to the obligation creation date.
{
  const before = await read(financePath);
  const sqliteOrder = "GROUP BY o.id ORDER BY COALESCE(next_due_on,o.created_at)";
  const mysqlSafeOrder = "GROUP BY o.id ORDER BY COALESCE(MIN(CASE WHEN i.status='ABERTA' THEN i.due_on END),o.created_at)";
  const after = before.includes(mysqlSafeOrder)
    ? before
    : replaceRequired(before, sqliteOrder, mysqlSafeOrder, "finance.ts next_due_on ORDER BY");
  await saveIfChanged(financePath, before, after, "Finance MySQL next_due_on compatibility");
}

// While a period has never been closed, the categories marked as participating
// in allocation are live configuration. Synchronize that list before rendering
// the monthly cash preview and before the first close. Once closure_version > 0,
// the historical snapshot remains immutable, including after a reopening.
{
  const before = await read(periodsPath);
  let after = before;

  const periodByIdAnchor = "async function periodById(ctx:Ctx,periodId:number){const row=await database().prepare(\"SELECT * FROM finance_periods WHERE id=? AND tenant_id=?\").bind(periodId,ctx.session.user.tenantId).first<Period>();if(!row)throw new ApiError(404,\"PERIODO_NAO_ENCONTRADO\",\"Período financeiro não encontrado.\");await unit(ctx,row.unit_id);return row;}";
  const syncHelper = `async function syncNeverClosedPeriodCategories(ctx:Ctx,periodId:number,closureVersion:number){\n  if(closureVersion!==0)return;\n  const categories=await database().prepare("SELECT id FROM finance_categories WHERE tenant_id=? AND kind='RECEITA' AND status='ATIVA' AND archived_at IS NULL AND participates_allocation=1 ORDER BY id").bind(ctx.session.user.tenantId).all<{id:number}>();\n  const categoryJson=JSON.stringify(categories.results.map(row=>Number(row.id)));\n  await database().prepare("UPDATE finance_period_allocation_rules SET participating_category_ids_json=? WHERE tenant_id=? AND period_id=?").bind(categoryJson,ctx.session.user.tenantId,periodId).run();\n}\n`;
  if (!after.includes("async function syncNeverClosedPeriodCategories(")) {
    after = replaceRequired(after, periodByIdAnchor, `${syncHelper}${periodByIdAnchor}`, "finance-periods live category helper");
  }

  const workspaceAnchor = "  const [rules,periodRules,closures,sessions,totals,configHistory,periodRuleHistory,closedAllocationRows,reopenRequest,pendingRequests]=await Promise.all([";
  const workspaceSync = "  if(period)await syncNeverClosedPeriodCategories(ctx,Number(period.id),Number(period.closure_version||0));\n";
  if (!after.includes(workspaceSync.trim())) {
    after = replaceRequired(after, workspaceAnchor, `${workspaceSync}${workspaceAnchor}`, "finance-periods workspace category sync");
  }

  const closeAnchor = "  const [totals,rules]=await Promise.all([database().prepare(periodTotalsSql).bind(ctx.session.user.tenantId,period.id).first<Record<string,unknown>>(),database().prepare(\"SELECT * FROM finance_period_allocation_rules WHERE tenant_id=? AND period_id=? ORDER BY display_order\").bind(ctx.session.user.tenantId,period.id).all<Record<string,unknown>>()]);";
  const closeSync = "  await syncNeverClosedPeriodCategories(ctx,period.id,period.closure_version);\n";
  if (!after.includes(closeSync.trim())) {
    after = replaceRequired(after, closeAnchor, `${closeSync}${closeAnchor}`, "finance-periods close category sync");
  }

  const oldQuickPerson = "  const sameUnit=selectedUnit.type===\"FILIAL\"?person?.branch_id===selectedUnit.id:person?.matrix_id===selectedUnit.id&&(person.branch_id===null||ctx.permissions.has(\"FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR\"));";
  const newQuickPerson = "  const sameUnit=selectedUnit.type===\"FILIAL\"?person?.branch_id===selectedUnit.id:selectedUnit.type===\"MATRIZ\"?person?.matrix_id===selectedUnit.id&&(person.branch_id===null||ctx.permissions.has(\"FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR\")):ctx.session.user.scope===\"CONVENCAO\";";
  after = after.includes(newQuickPerson)
    ? after
    : replaceRequired(after, oldQuickPerson, newQuickPerson, "finance-periods quick person convention scope");

  await saveIfChanged(periodsPath, before, after, "Finance open-period allocation synchronization");
}

// Open reports must reflect the live participating-category configuration while
// the period has never been closed. Closed/reopened periods keep their stored
// category snapshot so historical reports never change retroactively.
{
  const before = await read(reportsPath);
  let after = before;

  const helperAnchor = "const openingArgs=(tenantId:number,unitId:number,start:string,accountId:number|null)=>accountId?[tenantId,unitId,accountId,tenantId,unitId,start,accountId]:[tenantId,unitId,tenantId,unitId,start];";
  const helper = `${helperAnchor}\nasync function currentParticipatingCategoryIds(tenantId:number){const rows=await database().prepare("SELECT id FROM finance_categories WHERE tenant_id=? AND kind='RECEITA' AND status='ATIVA' AND archived_at IS NULL AND participates_allocation=1 ORDER BY id").bind(tenantId).all<{id:number}>();return rows.results.map(row=>Number(row.id));}`;
  if (!after.includes("async function currentParticipatingCategoryIds(")) {
    after = replaceRequired(after, helperAnchor, helper, "finance-reports live category helper");
  }

  const closureAnchor = "  const closure=Number(period.closure_version||0)>0?await database().prepare(\"SELECT * FROM finance_closure_versions WHERE tenant_id=? AND period_id=? AND version=?\").bind(tenant,period.id,period.closure_version).first<Record<string,unknown>>():null;";
  const liveCategoriesLine = "  const liveParticipatingCategoryIds=Number(period.closure_version||0)===0?await currentParticipatingCategoryIds(tenant):null;\n";
  if (!after.includes(liveCategoriesLine.trim())) {
    after = replaceRequired(after, closureAnchor, `${liveCategoriesLine}${closureAnchor}`, "finance-reports live category selection");
  }

  const categoryIdsOld = "const categoryIds=json<Array<number>>(rules[0]?.participating_category_ids_json,[]);";
  const categoryIdsNew = "const categoryIds=liveParticipatingCategoryIds??json<Array<number>>(rules[0]?.participating_category_ids_json,[]);";
  after = after.split(categoryIdsOld).join(categoryIdsNew);

  const outsideOld = "participatingCategoryIds=json<Array<number>>(snapshotRules[0]?.participating_category_ids_json,[]);";
  const outsideNew = "participatingCategoryIds=liveParticipatingCategoryIds??json<Array<number>>(snapshotRules[0]?.participating_category_ids_json,[]);";
  after = after.includes(outsideNew)
    ? after
    : replaceRequired(after, outsideOld, outsideNew, "finance-reports outside allocation categories");

  await saveIfChanged(reportsPath, before, after, "Finance open-report allocation synchronization");
}

// Quick entry now uses a dedicated contributor-search endpoint tied to the
// active quick session, instead of the generic Finance options endpoint.
{
  const before = await read(quickComponentPath);
  let after = before;
  const oldParams = "const params = new URLSearchParams({ q: query, unitId: String(data.session.unit_id), includeBranches: includeBranches ? \"1\" : \"0\" }); void fetch(`/api/finance/options?${params}`";
  const newParams = "const params = new URLSearchParams({ q: query, sessionId: String(data.session.id), includeBranches: includeBranches ? \"1\" : \"0\" }); void fetch(`/api/finance/quick/people?${params}`";
  after = after.includes(newParams)
    ? after
    : replaceRequired(after, oldParams, newParams, "finance quick contributor endpoint");

  const oldDeps = "[query, person, includeBranches, data.session.unit_id]";
  const newDeps = "[query, person, includeBranches, data.session.id]";
  after = after.includes(newDeps)
    ? after
    : replaceRequired(after, oldDeps, newDeps, "finance quick contributor effect dependency");

  await saveIfChanged(quickComponentPath, before, after, "Finance quick contributor search");
}

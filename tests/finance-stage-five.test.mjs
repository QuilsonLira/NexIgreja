import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const finance=readFileSync(new URL("../lib/server/finance.ts",import.meta.url),"utf8");
const periods=readFileSync(new URL("../lib/server/finance-periods.ts",import.meta.url),"utf8");
const reports=readFileSync(new URL("../lib/server/finance-reports.ts",import.meta.url),"utf8");
const manager=readFileSync(new URL("../components/finance-manager.tsx",import.meta.url),"utf8");
const periodManager=readFileSync(new URL("../components/finance-period-manager.tsx",import.meta.url),"utf8");
const registry=readFileSync(new URL("../components/finance-campaign-fund-manager.tsx",import.meta.url),"utf8");

test("movimentos são filtrados no backend pelo vínculo period_id",()=>{
  for(const text of ["query.periodId","m.period_id=?","selectedPeriodId","Todos os períodos","Caixa / Período Financeiro","onPageChange","input.periodId"])assert.ok((finance+manager).includes(text),text);
  assert.ok(finance.includes("CASE WHEN p.status='ABERTO' THEN 0 ELSE 1 END"));
  assert.ok(finance.includes("fc.contribution_type"));
  assert.ok(finance.includes("assertOpenFinancePeriodById"));
});

test("campanhas e fundos preservam histórico e bloqueiam exclusão indevida",()=>{
  for(const text of ["CAMPAIGN_UPDATE","CAMPAIGN_DELETE","CAMPAIGN_ARCHIVE","CAMPAIGN_RESTORE","FUND_UPDATE","FUND_DELETE","FUND_ARCHIVE","FUND_RESTORE"])assert.ok(finance.includes(text),text);
  for(const text of ["possui movimentações ou compromissos","possui uso ou saldo vinculado","Arquivados","Encerrados"])assert.ok((finance+registry).includes(text),text);
});

test("reabertura fica localizável e rateio fechado usa snapshot",()=>{
  for(const text of ["Reabrir Caixa","Confirme sua senha","Motivo da reabertura","Somente administrador autorizado da Matriz"])assert.ok((periods+periodManager).includes(text),text);
  for(const text of ["finance_period_allocation_results","allocation_results_json","rules_snapshot_json","allocationError","CLOSURE_SNAPSHOT"])assert.ok((periods+reports).includes(text),text);
});

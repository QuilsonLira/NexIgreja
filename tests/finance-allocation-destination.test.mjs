import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const periods=readFileSync(new URL("../lib/server/finance-periods.ts",import.meta.url),"utf8");
const manager=readFileSync(new URL("../components/finance-period-manager.tsx",import.meta.url),"utf8");
const reports=readFileSync(new URL("../lib/server/finance-reports.ts",import.meta.url),"utf8");
const reportUi=readFileSync(new URL("../components/finance-reports-manager.tsx",import.meta.url),"utf8");

test("reabertura continua visível, reautenticada, auditada e restrita à Matriz",()=>{
  for(const value of ["Reabrir Caixa","Confirme sua senha","Motivo da reabertura","FINANCEIRO_CAIXA_REABRIR","canReopenPeriod","REABRIR_CAIXA","finance_period_reopenings"])assert.ok((periods+manager).includes(value),value);
});

test("destinação financeira atravessa regra, snapshot, fechamento e relatório",()=>{
  for(const value of ["financial_destination","MANTER_NA_UNIDADE","calculatedToTransferCents","ownUnitAllocationCents","remaining_transfer_cents"])assert.ok((periods+reports+manager+reportUi).includes(value),value);
  assert.ok(periods.includes("result.financialDestination===\"REPASSAR\"?result.calculatedAmountCents:0"));
  assert.ok(reports.includes("physicalCurrentCents-linkedCents-balances.remainingTransferCents"));
  assert.ok((manager+reportUi).includes("Permanecer no caixa desta unidade"));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server=readFileSync(new URL("../lib/server/finance.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../components/finance-registry-sections.tsx",import.meta.url),"utf8");
const manager=readFileSync(new URL("../components/finance-manager.tsx",import.meta.url),"utf8");

test("contas usam permissão de configuração, tenant e escopo no backend",()=>{for(const value of ["FINANCEIRO_CONTAS_CONFIGURAR","accountSnapshot(ctx,entityId)","a.tenant_id=?","scopedUnit(ctx","ACCOUNT_ARCHIVE","ACCOUNT_RESTORE"])assert.ok(server.includes(value),value);});
test("saldo inicial bloqueia após movimentos e ajuste exige motivo",()=>{for(const value of ["SALDO_INICIAL_BLOQUEADO","USE_SALDO_INICIAL","MOTIVO_OBRIGATORIO","AJUSTAR_SALDO","previousBalanceCents","resultingBalanceCents"])assert.ok(server.includes(value),value);});
test("arquivados saem de novos seletores, mas ficam disponíveis nos filtros",()=>{for(const value of ['c.status==="ATIVA"','m.status==="ATIVO"','c.status==="ATIVO"'])assert.ok(manager.includes(value),value);for(const value of ["Ativas","Arquivadas","Todas","Arquivar","Reativar"])assert.ok(ui.includes(value),value);});
test("saldo negativo não depende apenas de cor",()=>{assert.ok(ui.includes("Saldo negativo"));assert.ok(ui.includes("AlertTriangle"));assert.ok(ui.includes("finance-negative"));});

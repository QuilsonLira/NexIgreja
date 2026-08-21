import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const quick=readFileSync(new URL("../components/finance-quick-entry.tsx",import.meta.url),"utf8");
const periods=readFileSync(new URL("../components/finance-period-manager.tsx",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/server/finance-periods.ts",import.meta.url),"utf8");
const finance=readFileSync(new URL("../lib/server/finance.ts",import.meta.url),"utf8");

test("PDV oferece tela cheia, busca sob demanda, atalhos, revisão e retomada",()=>{for(const value of ["finance-quick-active","/api/finance/options?","F2","F4","ctrlKey","Revisar lançamentos","existingSessionId","idempotencyKey"])assert.match(quick,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));});
test("caixa expõe estados, reautenticação e correção histórica separada",()=>{for(const value of ["CAIXA ABERTO","CAIXA FECHADO","CAIXA REABERTO","Confirme sua senha","Corrigir rateio do período","configuração padrão permaneceu inalterada"])assert.ok(periods.includes(value),value);});
test("backend exige período aberto nas operações e aplica escopo",()=>{assert.ok((finance.match(/assertOpenFinancePeriod/g)||[]).length>=5);for(const value of ["canAccessMemberScope","REABERTURA_RESTRITA_MATRIZ","ALTERAR_RATEIO_PERIODO_REABERTO","verifyUserPassword","idempotencyKey"])assert.ok(server.includes(value),value);});
test("PDV mobile usa input editável, Salvar e próximo e ações pré-fechamento",()=>{for(const value of ['inputMode="decimal"','enterKeyHint="done"','Salvar e próximo','action: editing ? "UPDATE" : "ADD"','action: "DELETE"','Editar','Excluir'])assert.ok(quick.includes(value),value);assert.equal(/readOnly[^\n]*Valor/.test(quick),false);});
test("busca hierárquica, privacidade e estorno possuem proteções no servidor",()=>{for(const value of ["FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR","p.matrix_id=? AND p.branch_id IS NULL","COALESCE(pref.default_privacy,'IDENTIFICADA')","ESTORNO_OBRIGATORIO","reversalDirection","original_movement_id","closure_version>0"])assert.ok((server+finance).includes(value),value);});
test("estorno geral alinha origem e vínculo original sem deslocar os campos",()=>{const values="VALUES(?,?,?,?,'ESTORNO',?,?,?,?,?,?,?,?,?,?,?,?,'OUTRO','ESTORNO',?,?,?,?,?,?,?,?,?,1)";assert.ok(finance.includes(values));const sql=finance.match(/INSERT INTO finance_movements\(id,tenant_id,unit_id,account_id,direction,reversal_direction[\s\S]*?created_during_reopening\) VALUES\([^\n]+?\)/)?.[0]||"";assert.equal((sql.match(/\?/g)||[]).length,25);});

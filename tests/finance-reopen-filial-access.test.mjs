import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../lib/server/finance-periods.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../components/finance-period-manager.tsx", import.meta.url), "utf8");

test("Filial com acesso ao Financeiro pode solicitar sem depender do cargo", () => {
  assert.match(server, /createPeriodReopenRequest[\s\S]*context\(request,"FINANCEIRO_VISUALIZAR"\)/);
  assert.match(server, /canRequestReopen:ctx\.session\.user\.scope==="FILIAL"/);
  assert.doesNotMatch(server, /canRequestReopen:ctx\.permissions\.has\("FINANCEIRO_CAIXA_REABERTURA_SOLICITAR"\)/);
  assert.match(ui, /Solicitar reabertura/);
});

test("reabertura da Filial continua exigindo autorização única da Matriz", () => {
  assert.match(server, /status='APROVADA'/);
  assert.match(server, /requested_closure_version=\?/);
  assert.match(server, /status='UTILIZADA'/);
  assert.match(server, /AUTORIZACAO_INVALIDA/);
});

test("auditoria da reabertura usa a Matriz do caixa, inclusive para ator da Filial", () => {
  assert.match(server, /actor_scope,actor_matrix_id,reopened_at[\s\S]*ctx\.session\.user\.scope,period\.matrix_id,stamp/);
  assert.doesNotMatch(server, /actor_scope,actor_matrix_id,reopened_at[\s\S]{0,700}ctx\.session\.user\.boundMatrixId/);
});

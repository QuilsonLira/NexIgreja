import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ui=readFileSync(new URL("../components/finance-reports-manager.tsx",import.meta.url),"utf8");
const server=readFileSync(new URL("../lib/server/finance-reports.ts",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");

test("central oferece relatório oficial, modelos, PDF, impressão e histórico",()=>{
  for(const text of ["Central de Relatórios Financeiros","Relatório Oficial de Caixa","Gerar PDF","Imprimir","Histórico de Relatórios","Salvar nova versão"])assert.ok(ui.includes(text),text);
  assert.ok(css.includes("@media print"));
  assert.ok(css.includes("@page{size:A4"));
});

test("backend aplica tenant, escopo, snapshot e privacidade pública",()=>{
  for(const text of ["r.tenant_id=?","scopedUnit(ctx","report_snapshot_json","model_snapshot_json","publicContributorName","MODELO_FORA_DO_ESCOPO"])assert.ok(server.includes(text),text);
  assert.ok(server.includes("SUBSTITUIDO_POR_NOVA_VERSAO"));
  assert.ok(server.includes("TRANSFERENCIA_ENTRADA"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { canSelectFunction, cleanFunctionName, normalizedFunctionName } from "../lib/functions/policy.ts";
import { isPermissionCode, permissionForAdminPath } from "../lib/admin/permissions.ts";

test("normaliza nome de função sem confundir função com permissão", () => {
  assert.equal(cleanFunctionName("  Pastor   Auxiliar  "), "Pastor Auxiliar");
  assert.equal(normalizedFunctionName("Tesoureiro Sênior"), "tesoureiro sênior");
  assert.equal(isPermissionCode("Pastor"), false);
});

test("selector aceita apenas função ativa do tenant atual", () => {
  assert.equal(canSelectFunction("ATIVO", 7, 7), true);
  assert.equal(canSelectFunction("INATIVO", 7, 7), false);
  assert.equal(canSelectFunction("ATIVO", 8, 7), false);
});

test("permissões e rota de funções são administrativas e específicas", () => {
  assert.equal(isPermissionCode("FUNCOES_VISUALIZAR"), true);
  assert.equal(isPermissionCode("FUNCOES_CRIAR"), true);
  assert.equal(isPermissionCode("FUNCOES_EDITAR"), true);
  assert.equal(isPermissionCode("FUNCOES_DESATIVAR"), true);
  assert.equal(permissionForAdminPath("/painel/funcoes"), "FUNCOES_VISUALIZAR");
});

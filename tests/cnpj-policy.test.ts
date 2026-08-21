import assert from "node:assert/strict";
import test from "node:test";
import { canInheritCnpj, conflictsWithOwnCnpj, effectiveCnpj } from "../lib/unit/cnpj-policy.ts";
import { normalizeCnpj } from "../lib/server/validation.ts";

test("aceita CNPJ válido e rejeita documento inválido", () => {
  assert.equal(normalizeCnpj("11.222.333/0001-81"), "11222333000181");
  assert.equal(normalizeCnpj("11.111.111/1111-11"), null);
});

test("somente filial com matriz que possui CNPJ pode herdar", () => {
  assert.equal(canInheritCnpj("FILIAL", "11222333000181"), true);
  assert.equal(canInheritCnpj("FILIAL", null), false);
  assert.equal(canInheritCnpj("MATRIZ", "11222333000181"), false);
});

test("CNPJ herdado acompanha automaticamente a alteração da matriz", () => {
  const branch = { type: "FILIAL" as const, ownCnpj: null, usesParentCnpj: true };
  assert.equal(effectiveCnpj({ ...branch, parentCnpj: "11222333000181" }), "11222333000181");
  assert.equal(effectiveCnpj({ ...branch, parentCnpj: "11444777000161" }), "11444777000161");
});

test("duplicidade própria é bloqueada no tenant e permitida entre tenants", () => {
  const existing = { tenantId: 1, ownCnpj: "11222333000181", usesParentCnpj: false };
  assert.equal(conflictsWithOwnCnpj(existing, { tenantId: 1, ownCnpj: "11222333000181" }), true);
  assert.equal(conflictsWithOwnCnpj(existing, { tenantId: 2, ownCnpj: "11222333000181" }), false);
  assert.equal(conflictsWithOwnCnpj({ ...existing, usesParentCnpj: true }, { tenantId: 1, ownCnpj: "11222333000181" }), false);
});

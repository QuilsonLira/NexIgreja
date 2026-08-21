import assert from "node:assert/strict";
import test from "node:test";
import {
  isInstitutionAvailable,
  isInstitutionCode,
  loginIsolationNamespace,
} from "../lib/auth/tenant-login-policy.ts";

test("código institucional exige exatamente 7 números", () => {
  assert.equal(isInstitutionCode("4837261"), true);
  assert.equal(isInstitutionCode("123456"), false);
  assert.equal(isInstitutionCode("12345678"), false);
  assert.equal(isInstitutionCode("12A4567"), false);
});

test("somente cliente ativo pode avançar ao login", () => {
  assert.equal(isInstitutionAvailable("ATIVO"), true);
  assert.equal(isInstitutionAvailable("SUSPENSO"), false);
  assert.equal(isInstitutionAvailable("CANCELADO"), false);
  assert.equal(isInstitutionAvailable(null), false);
});

test("tentativas e credenciais iguais permanecem isoladas por tenant", () => {
  assert.equal(loginIsolationNamespace("ORGANIZATIONAL", 1), "TENANT:1");
  assert.equal(loginIsolationNamespace("ORGANIZATIONAL", 2), "TENANT:2");
  assert.notEqual(loginIsolationNamespace("ORGANIZATIONAL", 1), loginIsolationNamespace("ORGANIZATIONAL", 2));
  assert.throws(() => loginIsolationNamespace("ORGANIZATIONAL", null), /tenant context is required/);
});

test("login do Platform Owner usa domínio separado e não pede tenant", () => {
  assert.equal(loginIsolationNamespace("PLATFORM", null), "PLATFORM");
});

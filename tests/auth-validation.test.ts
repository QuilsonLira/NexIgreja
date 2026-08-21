import assert from "node:assert/strict";
import test from "node:test";
import {
  isValidCnpj,
  isValidCpf,
  normalizeBrazilianState,
  normalizeCnpj,
  normalizeCpf,
  normalizeDigits,
  normalizeEmail,
  normalizeLoginIdentifier,
  normalizePhone,
} from "../lib/server/validation.ts";
import { isUnitWithinScope } from "../lib/server/authorization.ts";
import { isPasswordValid, PASSWORD_POLICY_MESSAGE, passwordPolicyMessage } from "../lib/password-policy.ts";

test("aceita qualquer composição de senha com pelo menos 4 caracteres", () => {
  for (const password of ["1234", "abcd", "Joao", "a1b2", "Senha@123"]) {
    assert.equal(isPasswordValid(password), true, `deveria aceitar ${password}`);
    assert.equal(passwordPolicyMessage(password), null);
  }
});

test("rejeita somente senhas com menos de 4 caracteres", () => {
  for (const password of ["", "1", "12", "123", "abc"]) {
    assert.equal(isPasswordValid(password), false, `deveria rejeitar ${password}`);
    assert.equal(passwordPolicyMessage(password), PASSWORD_POLICY_MESSAGE);
  }
  assert.equal(isPasswordValid("a".repeat(256)), true);
});

test("accepts valid CPFs and strips punctuation", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("16899535009"), true);
  assert.equal(isValidCpf("111.444.777-35"), true);
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
});

test("rejects repeated or invalid CPF digits", () => {
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("529.982.247-24"), false);
  assert.equal(isValidCpf("123"), false);
});

test("detects and normalizes the three login methods", () => {
  assert.deepEqual(normalizeLoginIdentifier(" 529.982.247-25 "), {
    type: "CPF",
    normalized: "52998224725",
    valid: true,
  });
  assert.deepEqual(normalizeLoginIdentifier(" Admin@NexIgreja.com.br "), {
    type: "EMAIL",
    normalized: "admin@nexigreja.com.br",
    valid: true,
  });
  assert.deepEqual(normalizeLoginIdentifier(" Gestor.Matriz "), {
    type: "USUARIO",
    normalized: "gestor.matriz",
    valid: true,
  });
});

test("marks malformed identifiers as invalid without changing their detected method", () => {
  assert.equal(normalizeLoginIdentifier("529.982.247-24").type, "CPF");
  assert.equal(normalizeLoginIdentifier("529.982.247-24").valid, false);
  assert.equal(normalizeLoginIdentifier("nome@").type, "EMAIL");
  assert.equal(normalizeLoginIdentifier("nome@").valid, false);
  assert.equal(normalizeLoginIdentifier("a").type, "USUARIO");
  assert.equal(normalizeLoginIdentifier("a").valid, false);
});

test("blocks a filial user from changing an ID to another filial", () => {
  const ownBranch = isUnitWithinScope({
    scope: "FILIAL",
    scopeUnitId: 4,
    scopeUnitType: "FILIAL",
    target: { id: 4, type: "FILIAL", status: "ATIVO", parentId: 2, parentStatus: "ATIVO", grandparentId: 1, grandparentStatus: "ATIVO" },
  });
  const tamperedBranch = isUnitWithinScope({
    scope: "FILIAL",
    scopeUnitId: 4,
    scopeUnitType: "FILIAL",
    target: { id: 5, type: "FILIAL", status: "ATIVO", parentId: 2, parentStatus: "ATIVO", grandparentId: 1, grandparentStatus: "ATIVO" },
  });
  assert.equal(ownBranch, true);
  assert.equal(tamperedBranch, false);
});

test("allows a matrix only inside itself and its own filials", () => {
  assert.equal(isUnitWithinScope({
    scope: "MATRIZ",
    scopeUnitId: 2,
    scopeUnitType: "MATRIZ",
    target: { id: 5, type: "FILIAL", status: "ATIVO", parentId: 2, parentStatus: "ATIVO", grandparentId: 1, grandparentStatus: "ATIVO" },
  }), true);
  assert.equal(isUnitWithinScope({
    scope: "MATRIZ",
    scopeUnitId: 2,
    scopeUnitType: "MATRIZ",
    target: { id: 7, type: "FILIAL", status: "ATIVO", parentId: 3, parentStatus: "ATIVO", grandparentId: 1, grandparentStatus: "ATIVO" },
  }), false);
});

test("valida e normaliza CNPJ sem pontuação", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(normalizeCnpj("11.222.333/0001-81"), "11222333000181");
  assert.equal(isValidCnpj("11.222.333/0001-80"), false);
  assert.equal(normalizeCnpj("11.222.333/0001-80"), null);
});

test("normaliza os campos de contato e endereço", () => {
  assert.equal(normalizeDigits("68.488-000"), "68488000");
  assert.equal(normalizeEmail("  CONTATO@IGREJA.COM.BR "), "contato@igreja.com.br");
  assert.equal(normalizeEmail("contato@"), null);
  assert.equal(normalizePhone("(94) 99999-0000"), "94999990000");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizeBrazilianState("pa"), "PA");
  assert.equal(normalizeBrazilianState("XX"), null);
});

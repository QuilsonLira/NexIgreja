import assert from "node:assert/strict";
import test from "node:test";
import {
  canActivateMembership,
  isUsableMembership,
  membershipPermissions,
  requiresOrganizationSelection,
  type MembershipCandidate,
} from "../lib/membership/policy.ts";

const membership = (overrides: Partial<MembershipCandidate> = {}): MembershipCandidate => ({
  id: 10,
  userId: 7,
  tenantId: 100,
  status: "ATIVO",
  archived: false,
  tenantOperational: true,
  scopeOperational: true,
  ...overrides,
});

test("duas credenciais válidas para o mesmo identificador exigem escolha da organização", () => {
  assert.equal(requiresOrganizationSelection([{ membershipStatus: "ATIVO" }, { membershipStatus: "ATIVO" }]), true);
  assert.equal(requiresOrganizationSelection([{ membershipStatus: "ATIVO" }]), false);
});

test("convite pendente exige decisão explícita antes do painel", () => {
  assert.equal(requiresOrganizationSelection([{ membershipStatus: "PENDENTE" }]), true);
  assert.equal(isUsableMembership(membership({ status: "PENDENTE" })), false);
  assert.equal(isUsableMembership(membership({ status: "PENDENTE" }), true), true);
});

test("sessão não pode ativar vínculo pertencente a outra identidade", () => {
  assert.equal(canActivateMembership(7, membership()), true);
  assert.equal(canActivateMembership(8, membership()), false);
});

test("tenant suspenso, unidade inativa e vínculo arquivado são recusados", () => {
  assert.equal(isUsableMembership(membership({ tenantOperational: false })), false);
  assert.equal(isUsableMembership(membership({ scopeOperational: false })), false);
  assert.equal(isUsableMembership(membership({ archived: true })), false);
});

test("desativar um vínculo não afeta outro tenant", () => {
  const tenantA = membership({ id: 10, tenantId: 100, status: "INATIVO" });
  const tenantB = membership({ id: 11, tenantId: 200, status: "ATIVO" });
  assert.equal(isUsableMembership(tenantA), false);
  assert.equal(isUsableMembership(tenantB), true);
});

test("função e permissões permanecem independentes por vínculo", () => {
  const assignments = [
    { membershipId: 10, permission: "USUARIOS_VISUALIZAR" },
    { membershipId: 11, permission: "UNIDADES_EDITAR" },
  ] as const;
  assert.deepEqual(membershipPermissions(10, assignments), ["USUARIOS_VISUALIZAR"]);
  assert.deepEqual(membershipPermissions(11, assignments), ["UNIDADES_EDITAR"]);
});

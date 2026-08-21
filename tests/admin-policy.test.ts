import assert from "node:assert/strict";
import test from "node:test";
import { canAdministerUnit, canAdministerUser } from "../lib/admin/policy.ts";
import { hasPermission, permissionForAdminPath } from "../lib/admin/permissions.ts";
import type { AdministrativeActor } from "../lib/types.ts";
import type { UnitRecord } from "../lib/admin/types.ts";

const actor = (scope: AdministrativeActor["scope"]): AdministrativeActor => ({
  id: scope === "CONVENCAO" ? 1 : scope === "MATRIZ" ? 2 : 3,
  membershipId: scope === "CONVENCAO" ? 1 : scope === "MATRIZ" ? 2 : 3,
  name: "Teste",
  conventionId: 10,
  tenantId: 1,
  tenantStatus: "ATIVO",
  scope,
  boundMatrixId: scope === "MATRIZ" ? 20 : null,
  boundBranchId: scope === "FILIAL" ? 30 : null,
  mustChangePassword: false,
  isPlatformOwner: false,
});

const unit = (id: number, type: UnitRecord["type"], conventionId = 10, matrixId: number | null = null): UnitRecord => ({
  id, tenantId: 1, type, conventionId, matrixId, name: "Unidade", status: "ATIVO",
  fantasyName: null, legalName: null, cnpj: null, phone: null, whatsapp: null,
  email: null, postalCode: null, street: null, number: null, complement: null,
  district: null, city: null, state: null, responsibleName: null, foundationDate: null, notes: null,
  conventionName: "Convenção", matrixName: null, parentName: null,
  logoUrl: null,
  archivedAt: null, archivedBy: null, archivedByName: null, archivedPreviousStatus: null,
  createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
});

test("convenção não atravessa para outra convenção", () => {
  assert.equal(canAdministerUnit(actor("CONVENCAO"), unit(20, "MATRIZ", 99)), false);
});

test("matriz administra a própria matriz e suas filiais", () => {
  assert.equal(canAdministerUnit(actor("MATRIZ"), unit(20, "MATRIZ")), true);
  assert.equal(canAdministerUnit(actor("MATRIZ"), unit(31, "FILIAL", 10, 20)), true);
  assert.equal(canAdministerUnit(actor("MATRIZ"), unit(40, "MATRIZ")), false);
  assert.equal(canAdministerUnit(actor("MATRIZ"), unit(41, "FILIAL", 10, 40)), false);
});

test("filial fica restrita à própria filial", () => {
  assert.equal(canAdministerUnit(actor("FILIAL"), unit(30, "FILIAL", 10, 20)), true);
  assert.equal(canAdministerUnit(actor("FILIAL"), unit(31, "FILIAL", 10, 20)), false);
  assert.equal(canAdministerUnit(actor("FILIAL"), unit(20, "MATRIZ")), false);
});

test("matriz não administra usuário da convenção ou de outra matriz", () => {
  const matrixActor = actor("MATRIZ");
  assert.equal(canAdministerUser(matrixActor, { tenantId: 1, conventionId: 10, scope: "CONVENCAO", boundMatrixId: null, boundBranchId: null, branchMatrixId: null }), false);
  assert.equal(canAdministerUser(matrixActor, { tenantId: 1, conventionId: 10, scope: "MATRIZ", boundMatrixId: 20, boundBranchId: null, branchMatrixId: null }), true);
  assert.equal(canAdministerUser(matrixActor, { tenantId: 1, conventionId: 10, scope: "FILIAL", boundMatrixId: null, boundBranchId: 31, branchMatrixId: 20 }), true);
  assert.equal(canAdministerUser(matrixActor, { tenantId: 1, conventionId: 10, scope: "FILIAL", boundMatrixId: null, boundBranchId: 41, branchMatrixId: 40 }), false);
});

test("filial não administra usuário de outra filial", () => {
  const branchActor = actor("FILIAL");
  assert.equal(canAdministerUser(branchActor, { tenantId: 1, conventionId: 10, scope: "FILIAL", boundMatrixId: null, boundBranchId: 30, branchMatrixId: 20 }), true);
  assert.equal(canAdministerUser(branchActor, { tenantId: 1, conventionId: 10, scope: "FILIAL", boundMatrixId: null, boundBranchId: 31, branchMatrixId: 20 }), false);
});

test("cada página administrativa exige sua permissão individual", () => {
  assert.equal(permissionForAdminPath("/painel/usuarios"), "USUARIOS_VISUALIZAR");
  assert.equal(permissionForAdminPath("/painel/unidades/editar"), "UNIDADES_VISUALIZAR");
  assert.equal(permissionForAdminPath("/painel/acessos"), "ACESSOS_VISUALIZAR");
  assert.equal(permissionForAdminPath("/painel/assinatura"), "ASSINATURA_VISUALIZAR");
  assert.equal(permissionForAdminPath("/painel"), null);
});

test("permissão desmarcada deixa de autorizar a área e a ação", () => {
  const permissions = ["UNIDADES_VISUALIZAR"] as const;
  assert.equal(hasPermission(permissions, "UNIDADES_VISUALIZAR"), true);
  assert.equal(hasPermission(permissions, "UNIDADES_CRIAR"), false);
  assert.equal(hasPermission([], "USUARIOS_VISUALIZAR"), false);
});

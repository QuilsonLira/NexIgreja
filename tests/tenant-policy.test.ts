import assert from "node:assert/strict";
import test from "node:test";
import { canAdministerUnit, canAdministerUser } from "../lib/admin/policy.ts";
import { isTenantOperational, normalizeTenantSlug, sameTenant, tenantAccessStatus } from "../lib/tenant/policy.ts";
import type { UnitRecord } from "../lib/admin/types.ts";
import type { AdministrativeActor } from "../lib/types.ts";

const actor: AdministrativeActor = {
  id: 7, name: "Admin A", tenantId: 101, tenantStatus: "ATIVO", conventionId: 1,
  membershipId: 7,
  scope: "CONVENCAO", boundMatrixId: null, boundBranchId: null,
  mustChangePassword: false, isPlatformOwner: false,
};

const unit = (tenantId: number): UnitRecord => ({
  id: 2, tenantId, type: "MATRIZ", conventionId: 1, matrixId: 2, name: "Matriz", status: "ATIVO",
  fantasyName: null, legalName: null, cnpj: null, phone: null, whatsapp: null, email: null,
  postalCode: null, street: null, number: null, complement: null, district: null, city: null,
  state: null, responsibleName: null, foundationDate: null, notes: null, conventionName: "Convenção",
  matrixName: "Matriz", parentName: "Convenção", logoUrl: null, archivedAt: null, archivedBy: null,
  archivedByName: null, archivedPreviousStatus: null, createdAt: "", updatedAt: "",
});

test("dois tenants podem repetir a mesma hierarquia sem compartilhar registros", () => {
  assert.equal(canAdministerUnit(actor, unit(101)), true);
  assert.equal(canAdministerUnit(actor, unit(202)), false);
  assert.equal(canAdministerUser(actor, { tenantId: 202, conventionId: 1, scope: "CONVENCAO", boundMatrixId: null, boundBranchId: null, branchMatrixId: null }), false);
});

test("tentativa IDOR entre tenants responde como registro inexistente", () => {
  assert.equal(sameTenant(101, 101), true);
  assert.equal(sameTenant(101, 202), false);
  assert.equal(tenantAccessStatus(101, 202), 404);
});

test("tenant suspenso ou cancelado não é operacional", () => {
  assert.equal(isTenantOperational("ATIVO"), true);
  assert.equal(isTenantOperational("SUSPENSO"), false);
  assert.equal(isTenantOperational("CANCELADO"), false);
});

test("slug do tenant é estável e seguro", () => {
  assert.equal(normalizeTenantSlug(" Igreja Ágape / Norte "), "igreja-agape-norte");
});

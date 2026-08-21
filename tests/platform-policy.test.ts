import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSION_CODES, isPermissionCode } from "../lib/admin/permissions.ts";
import { canAdministerUnit } from "../lib/admin/policy.ts";
import {
  archivedUnitState,
  canArchiveEntity,
  canDeleteOwnAccount,
  hasBlockingDependencies,
  isConventionCreationAllowed,
  permanentDeletionPhrase,
  platformOwnerStatus,
  canUseOrganizationalAdministration,
  restoredUnitStatus,
  userPermanentDeletionPhrase,
} from "../lib/platform/policy.ts";
import { classifyUnexpectedError } from "../lib/server/error-policy.ts";
import type { AdministrativeActor } from "../lib/types.ts";
import type { UnitRecord } from "../lib/admin/types.ts";

const actor = (conventionId: number): AdministrativeActor => ({
  id: conventionId, name: "Administrador", conventionId, scope: "CONVENCAO",
  membershipId: conventionId,
  tenantId: 1, tenantStatus: "ATIVO",
  boundMatrixId: null, boundBranchId: null, mustChangePassword: false, isPlatformOwner: false,
});

const unit = (id: number, conventionId: number): UnitRecord => ({
  id, tenantId: 1, type: "MATRIZ", conventionId, matrixId: id, name: "Matriz", status: "ATIVO",
  fantasyName: null, legalName: null, cnpj: null, phone: null, whatsapp: null, email: null,
  postalCode: null, street: null, number: null, complement: null, district: null, city: null,
  state: null, responsibleName: null, foundationDate: null, notes: null, conventionName: "Convenção",
  matrixName: "Matriz", parentName: "Convenção", logoUrl: null, archivedAt: null, archivedBy: null,
  archivedByName: null, archivedPreviousStatus: null, createdAt: "", updatedAt: "",
});

test("administrador de Convenção não recebe criação de Convenção nem exclusão como permissão", () => {
  assert.equal(isConventionCreationAllowed(false), false);
  assert.equal(isPermissionCode("EXCLUIR_UNIDADE"), false);
  assert.equal(PERMISSION_CODES.includes("EXCLUIR_UNIDADE" as never), false);
});

test("todas as permissões comuns continuam retornando 403 na API exclusiva", () => {
  assert.ok(PERMISSION_CODES.length > 0);
  assert.equal(platformOwnerStatus(false), 403);
});

test("somente Platform Owner passa pela autorização estrutural e cria Convenção", () => {
  assert.equal(platformOwnerStatus(true), 200);
  assert.equal(isConventionCreationAllowed(true), true);
});

test("Platform Owner só usa administração organizacional em contexto explícito", () => {
  assert.equal(canUseOrganizationalAdministration(true, false), false);
  assert.equal(canUseOrganizationalAdministration(true, true), true);
  assert.equal(canUseOrganizationalAdministration(false, false), true);
});

test("arquivamento preserva status e restauração recupera o estado anterior", () => {
  assert.deepEqual(archivedUnitState("ATIVO"), { status: "INATIVO", previousStatus: "ATIVO" });
  assert.equal(restoredUnitStatus("ATIVO"), "ATIVO");
  assert.equal(restoredUnitStatus("INATIVO"), "INATIVO");
});

test("dependências bloqueiam exclusão física e registro vazio pode ser removido", () => {
  assert.equal(hasBlockingDependencies([{ source: "usuários", count: 1 }]), true);
  assert.equal(hasBlockingDependencies([{ source: "sessões", count: 0 }]), false);
  assert.equal(hasBlockingDependencies([]), false);
  assert.equal(permanentDeletionPhrase("Convenção Teste"), "EXCLUIR Convenção Teste");
  assert.equal(userPermanentDeletionPhrase("João da Silva"), "EXCLUIR João da Silva");
});

test("fluxo de arquivamento exige desativação prévia", () => {
  assert.equal(canArchiveEntity("ATIVO"), false);
  assert.equal(canArchiveEntity("INATIVO"), true);
});

test("Platform Owner não pode excluir a própria conta", () => {
  assert.equal(canDeleteOwnAccount(1, 1), false);
  assert.equal(canDeleteOwnAccount(1, 2), true);
});

test("foreign key é conflito de integridade e não indisponibilidade", () => {
  const result = classifyUnexpectedError(new Error("D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT"));
  assert.equal(result.status, 409);
  assert.equal(result.code, "CONFLITO_INTEGRIDADE");
});

test("migration pendente e banco realmente indisponível possuem respostas diferentes", () => {
  assert.deepEqual(classifyUnexpectedError(new Error("D1_ERROR: no such column: archived_at")), {
    status: 500,
    code: "MIGRATION_PENDENTE",
    message: "A estrutura do banco de dados precisa ser atualizada antes de concluir esta operação.",
  });
  assert.equal(classifyUnexpectedError(new Error("database unavailable: connection timed out")).status, 503);
});

test("Convenção A nunca administra Convenção B e a hierarquia atual permanece", () => {
  assert.equal(canAdministerUnit(actor(1), unit(2, 1)), true);
  assert.equal(canAdministerUnit(actor(1), unit(3, 2)), false);
});

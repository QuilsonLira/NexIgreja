import assert from "node:assert/strict";
import test from "node:test";
import {
  cameraFailureMessage,
  detectImageMime,
  frontendImageError,
  profilePresentation,
  resolveEffectiveLogoUrl,
  validateImageBytes,
} from "../lib/image-policy.ts";
import { canAdministerUnit, canAdministerUser, canReadUnitLogo } from "../lib/admin/policy.ts";
import { hasPermission } from "../lib/admin/permissions.ts";
import type { AdministrativeActor } from "../lib/types.ts";
import type { UnitRecord } from "../lib/admin/types.ts";

const convention = "/api/media/units/1/logo?v=conv";
const matrix = "/api/media/units/2/logo?v=matrix";
const branch = "/api/media/units/4/logo?v=branch";

test("unidade sem logo usa fallback e a hierarquia prioriza filial, matriz e convenção", () => {
  assert.equal(resolveEffectiveLogoUrl({}), null);
  assert.equal(resolveEffectiveLogoUrl({ convention }), convention);
  assert.equal(resolveEffectiveLogoUrl({ convention, matrix }), matrix);
  assert.equal(resolveEffectiveLogoUrl({ convention, matrix, branch }), branch);
});

test("troca de contexto recalcula a logo efetiva e remoção volta ao fallback", () => {
  const matrixContext = resolveEffectiveLogoUrl({ convention, matrix });
  const branchContext = resolveEffectiveLogoUrl({ convention, matrix, branch });
  const removedBranch = resolveEffectiveLogoUrl({ convention, matrix, branch: null });
  const removedMatrix = resolveEffectiveLogoUrl({ convention, matrix: null, branch: null });
  assert.equal(matrixContext, matrix);
  assert.equal(branchContext, branch);
  assert.equal(removedBranch, matrix);
  assert.equal(removedMatrix, convention);
});

test("usuário sem foto usa inicial e usuário com foto usa avatar", () => {
  assert.deepEqual(profilePresentation("Quilson Lira", null), { photoUrl: null, initial: "Q" });
  assert.deepEqual(profilePresentation("Quilson Lira", "/foto"), { photoUrl: "/foto", initial: "Q" });
  assert.deepEqual(profilePresentation("Ana", null), { photoUrl: null, initial: "A" });
});

test("upload inválido ou MIME forjado é recusado", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(detectImageMime(png), "image/png");
  assert.equal(detectImageMime(jpeg), "image/jpeg");
  assert.equal(detectImageMime(webp), "image/webp");
  assert.equal(validateImageBytes(png, "image/png"), "image/png");
  assert.equal(validateImageBytes(png, "image/jpeg"), null);
  assert.equal(validateImageBytes(Uint8Array.from([1, 2, 3]), "image/png"), null);
  assert.match(frontendImageError({ type: "image/gif", size: 100 }) ?? "", /PNG/);
});

test("câmera negada não quebra o fluxo e oferece escolha de imagem", () => {
  assert.match(cameraFailureMessage(new DOMException("denied", "NotAllowedError")), /escolher uma imagem/i);
});

test("permissão e escopo protegem fotos de terceiros e logos de outras unidades", () => {
  const actor: AdministrativeActor = { id: 20, membershipId: 20, name: "Gestor", tenantId: 1, tenantStatus: "ATIVO", conventionId: 1, scope: "MATRIZ", boundMatrixId: 2, boundBranchId: null, mustChangePassword: false, isPlatformOwner: false };
  assert.equal(hasPermission([], "USUARIOS_EDITAR"), false);
  assert.equal(canAdministerUser(actor, { tenantId: 1, conventionId: 1, scope: "MATRIZ", boundMatrixId: 3, boundBranchId: null, branchMatrixId: null }), false);
  const otherMatrix = { id: 3, tenantId: 1, type: "MATRIZ", conventionId: 1, matrixId: 3, name: "Outra", status: "ATIVO", fantasyName: null, legalName: null, cnpj: null, phone: null, whatsapp: null, email: null, postalCode: null, street: null, number: null, complement: null, district: null, city: null, state: null, responsibleName: null, foundationDate: null, notes: null, conventionName: "Convenção", matrixName: "Outra", parentName: "Convenção", logoUrl: null, archivedAt: null, archivedBy: null, archivedByName: null, archivedPreviousStatus: null, createdAt: "", updatedAt: "" } satisfies UnitRecord;
  assert.equal(canAdministerUnit(actor, otherMatrix), false);
  assert.equal(canReadUnitLogo(actor, { matrixId: 2, branchId: null, unitName: "Matriz", unitType: "MATRIZ" }, otherMatrix), false);
});

test("fallback de logo permite ler somente a cadeia organizacional ativa", () => {
  const actor: AdministrativeActor = { id: 30, membershipId: 30, name: "Filial", tenantId: 1, tenantStatus: "ATIVO", conventionId: 1, scope: "FILIAL", boundMatrixId: null, boundBranchId: 4, mustChangePassword: false, isPlatformOwner: false };
  const context = { matrixId: 2, branchId: 4, unitName: "Filial", unitType: "FILIAL" } as const;
  const base = { tenantId: 1, name: "Unidade", status: "ATIVO", fantasyName: null, legalName: null, cnpj: null, phone: null, whatsapp: null, email: null, postalCode: null, street: null, number: null, complement: null, district: null, city: null, state: null, responsibleName: null, foundationDate: null, notes: null, conventionName: "Convenção", matrixName: null, parentName: null, logoUrl: null, archivedAt: null, archivedBy: null, archivedByName: null, archivedPreviousStatus: null, createdAt: "", updatedAt: "" } as const;
  assert.equal(canReadUnitLogo(actor, context, { ...base, id: 1, type: "CONVENCAO", conventionId: 1, matrixId: null }), true);
  assert.equal(canReadUnitLogo(actor, context, { ...base, id: 2, type: "MATRIZ", conventionId: 1, matrixId: 2 }), true);
  assert.equal(canReadUnitLogo(actor, context, { ...base, id: 4, type: "FILIAL", conventionId: 1, matrixId: 2 }), true);
  assert.equal(canReadUnitLogo(actor, context, { ...base, id: 3, type: "MATRIZ", conventionId: 1, matrixId: 3 }), false);
  assert.equal(canReadUnitLogo(actor, context, { ...base, id: 9, type: "CONVENCAO", conventionId: 9, matrixId: null }), false);
});

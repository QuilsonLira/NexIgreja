import { describe, expect, it } from "vitest";
import { canAdministerUnit, canAdministerUser } from "@/lib/admin/scope";
import type { UnitRecord, UserRecord } from "@/lib/admin/types";
import type { OrganizationalUser } from "@/lib/auth/types";

const conventionActor: OrganizationalUser = {
  id: 1,
  conventionId: 10,
  scope: "CONVENCAO",
  boundMatrixId: null,
  boundBranchId: null
};
const matrixActor: OrganizationalUser = {
  id: 2,
  conventionId: 10,
  scope: "MATRIZ",
  boundMatrixId: 100,
  boundBranchId: null
};
const branchActor: OrganizationalUser = {
  id: 3,
  conventionId: 10,
  scope: "FILIAL",
  boundMatrixId: null,
  boundBranchId: 1001
};

function unit(overrides: Partial<UnitRecord> = {}): UnitRecord {
  return {
    id: 1001,
    type: "FILIAL",
    name: "Fonte de Luz",
    status: "ATIVO",
    conventionId: 10,
    conventionName: "Convencao",
    matrixId: 100,
    matrixName: "Matriz",
    parentName: "Matriz",
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides
  };
}

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 11,
    conventionId: 10,
    name: "Usuario",
    username: "usuario",
    email: "usuario@example.com",
    cpfHint: "***.***.***-25",
    roleName: "Secretario",
    status: "ATIVO",
    scope: "FILIAL",
    boundMatrixId: null,
    boundBranchId: 1001,
    branchMatrixId: 100,
    matrixName: null,
    branchName: "Fonte de Luz",
    permissions: [],
    activeSessions: 0,
    lastLoginAt: null,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides
  };
}

describe("escopo do modulo administrativo", () => {
  it("Convenção administra somente dados da própria convenção", () => {
    expect(canAdministerUnit(conventionActor, unit())).toBe(true);
    expect(canAdministerUnit(conventionActor, unit({ conventionId: 20 }))).toBe(false);
  });

  it("Matriz administra a própria matriz e suas filiais", () => {
    expect(canAdministerUnit(matrixActor, unit({ id: 100, type: "MATRIZ", matrixId: 100 }))).toBe(true);
    expect(canAdministerUnit(matrixActor, unit({ matrixId: 200 }))).toBe(false);
    expect(canAdministerUnit(matrixActor, unit({ id: 10, type: "CONVENCAO", matrixId: null }))).toBe(false);
  });

  it("Filial fica restrita à própria filial", () => {
    expect(canAdministerUnit(branchActor, unit())).toBe(true);
    expect(canAdministerUnit(branchActor, unit({ id: 1002 }))).toBe(false);
    expect(canAdministerUnit(branchActor, unit({ id: 100, type: "MATRIZ" }))).toBe(false);
  });

  it("Matriz não administra usuário da Convenção nem de outra matriz", () => {
    expect(canAdministerUser(matrixActor, user())).toBe(true);
    expect(canAdministerUser(matrixActor, user({ scope: "CONVENCAO", boundBranchId: null, branchMatrixId: null }))).toBe(false);
    expect(canAdministerUser(matrixActor, user({ branchMatrixId: 200 }))).toBe(false);
  });

  it("Filial administra somente usuários vinculados a ela", () => {
    expect(canAdministerUser(branchActor, user())).toBe(true);
    expect(canAdministerUser(branchActor, user({ boundBranchId: 1002 }))).toBe(false);
  });
});

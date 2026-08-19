import { describe, expect, it } from "vitest";
import { canAccessUnit, listAvailableContexts, resolveInitialContext } from "@/lib/auth/scope";
import type { OrganizationalUser } from "@/lib/auth/types";
import { FakeAuthStore } from "@/tests/fake-auth-store";

function makeDirectory() {
  const store = new FakeAuthStore();
  store.conventions = [
    { id: 10, name: "Convencao de Teste", status: "ATIVO" },
    { id: 20, name: "Outra Convencao", status: "ATIVO" }
  ];
  store.matrices = [
    { id: 1, conventionId: 10, name: "Matriz Breu Branco", status: "ATIVO" },
    { id: 2, conventionId: 10, name: "Matriz Tucurui", status: "ATIVO" },
    { id: 3, conventionId: 20, name: "Outra Convencao", status: "ATIVO" },
    { id: 4, conventionId: 10, name: "Matriz Inativa", status: "INATIVO" }
  ];
  store.branches = [
    { id: 11, matrixId: 1, name: "Fonte de Luz", status: "ATIVO" },
    { id: 12, matrixId: 1, name: "Nova Jerusalem", status: "ATIVO" },
    { id: 21, matrixId: 2, name: "Filial Tucurui", status: "ATIVO" },
    { id: 13, matrixId: 1, name: "Filial Inativa", status: "INATIVO" }
  ];
  return store;
}

const conventionUser: OrganizationalUser = {
  id: 1,
  conventionId: 10,
  scope: "CONVENCAO",
  boundMatrixId: null,
  boundBranchId: null
};
const matrixUser: OrganizationalUser = {
  id: 2,
  conventionId: 10,
  scope: "MATRIZ",
  boundMatrixId: 1,
  boundBranchId: null
};
const branchUser: OrganizationalUser = {
  id: 3,
  conventionId: 10,
  scope: "FILIAL",
  boundMatrixId: null,
  boundBranchId: 11
};

describe("isolamento organizacional no backend", () => {
  it("Convencao lista somente as matrizes da propria Convencao", async () => {
    const contexts = await listAvailableContexts(conventionUser, makeDirectory());
    expect(contexts.matrices.map((matrix) => matrix.id)).toEqual([1, 2]);
    expect(contexts.branches.map((branch) => branch.id)).toEqual([11, 12, 21]);
  });

  it("Convencao acessa matriz e filial validas", async () => {
    const decision = await canAccessUnit(conventionUser, 1, 12, makeDirectory());
    expect(decision.allowed).toBe(true);
    expect(decision.context?.unitName).toBe("Nova Jerusalem");
  });

  it("Convencao nao atravessa para outra Convencao", async () => {
    expect((await canAccessUnit(conventionUser, 3, null, makeDirectory())).allowed).toBe(false);
  });

  it("Matriz lista somente as filiais vinculadas a ela", async () => {
    const contexts = await listAvailableContexts(matrixUser, makeDirectory());
    expect(contexts.matrices.map((matrix) => matrix.id)).toEqual([1]);
    expect(contexts.branches.map((branch) => branch.id)).toEqual([11, 12]);
  });

  it("Matriz nao acessa outra matriz por adulteracao de ID", async () => {
    const decision = await canAccessUnit(matrixUser, 2, 21, makeDirectory());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("MATRIZ_DIFERENTE_DO_VINCULO");
  });

  it("Matriz nao acessa filial de outra matriz", async () => {
    expect((await canAccessUnit(matrixUser, 1, 21, makeDirectory())).allowed).toBe(false);
  });

  it("Filial recebe contexto fixo automaticamente", async () => {
    const context = await resolveInitialContext(branchUser, makeDirectory());
    expect(context).toMatchObject({ matrixId: 1, branchId: 11, unitType: "FILIAL" });
  });

  it("Filial nao acessa nem a propria matriz sem a filial", async () => {
    expect((await canAccessUnit(branchUser, 1, null, makeDirectory())).allowed).toBe(false);
  });

  it("Filial nao acessa outra filial por chamada manual", async () => {
    expect((await canAccessUnit(branchUser, 1, 12, makeDirectory())).allowed).toBe(false);
  });

  it("rejeita matriz e filial inativas ou inexistentes", async () => {
    const directory = makeDirectory();
    expect((await canAccessUnit(conventionUser, 4, null, directory)).allowed).toBe(false);
    expect((await canAccessUnit(conventionUser, 1, 13, directory)).allowed).toBe(false);
    expect((await canAccessUnit(conventionUser, 999, null, directory)).allowed).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { AdminService, PublicAdminError } from "@/lib/admin/service";
import type { AdminStore } from "@/lib/admin/store";
import type { PermissionCode } from "@/lib/admin/permissions";
import type { UnitRecord, UserRecord } from "@/lib/admin/types";
import type { AuthConfig } from "@/lib/auth/config";
import type { AuthenticatedSession, LoginUser, RequestMetadata } from "@/lib/auth/types";

const config: AuthConfig = {
  databaseUrl: "mysql://test:test@localhost:3306/test",
  sessionHmacKey: "session-key-for-tests-with-32-characters",
  cpfLookupHmacKey: "cpf-lookup-key-for-tests-with-32-chars",
  auditHmacKey: "audit-key-for-tests-with-more-than-32-chars",
  appOrigin: "http://localhost:3000",
  sessionTtlHours: 12,
  maxAttempts: 5,
  blockMinutes: 15,
  cookieSecure: false
};
const metadata: RequestMetadata = {
  ipHash: "a".repeat(64),
  originSummary: "Chrome em Android",
  userAgent: "Teste"
};

function loginUser(overrides: Partial<LoginUser> = {}): LoginUser {
  return {
    id: 1,
    conventionId: 10,
    name: "Administrador",
    username: "admin",
    roleName: "Administrador",
    status: "ATIVO",
    scope: "CONVENCAO",
    boundMatrixId: null,
    boundBranchId: null,
    passwordHash: "hash",
    failedAttempts: 0,
    blockedUntil: null,
    sessionVersion: 1,
    mustChangePassword: false,
    ...overrides
  };
}

function session(overrides: Partial<LoginUser> = {}): AuthenticatedSession {
  return {
    sessionId: "session",
    user: loginUser(overrides),
    activeContext: { matrixId: 100, branchId: null, unitName: "Matriz", unitType: "MATRIZ" },
    lastPreviousAccess: null,
    expiresAt: new Date(Date.now() + 60_000)
  };
}

function unit(overrides: Partial<UnitRecord> = {}): UnitRecord {
  return {
    id: 100,
    type: "MATRIZ",
    name: "Matriz",
    status: "ATIVO",
    conventionId: 10,
    conventionName: "Convencao",
    matrixId: 100,
    matrixName: "Matriz",
    parentName: "Convencao",
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides
  };
}

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 8,
    conventionId: 10,
    name: "Usuario",
    username: "usuario",
    email: "usuario@example.com",
    cpfHint: "***.***.***-25",
    roleName: "Secretario",
    status: "ATIVO",
    scope: "MATRIZ",
    boundMatrixId: 100,
    boundBranchId: null,
    branchMatrixId: null,
    matrixName: "Matriz",
    branchName: null,
    permissions: [],
    activeSessions: 1,
    lastLoginAt: null,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides
  };
}

function store(permissions: PermissionCode[], overrides: Partial<AdminStore> = {}): AdminStore {
  return {
    listPermissions: vi.fn().mockResolvedValue(permissions),
    listUnitOptions: vi.fn(),
    listUnits: vi.fn(),
    getUnit: vi.fn(),
    createMatrix: vi.fn(),
    createBranch: vi.fn(),
    updateUnit: vi.fn(),
    setUnitStatus: vi.fn(),
    listUsers: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setUserStatus: vi.fn(),
    resetUserPassword: vi.fn(),
    revokeUserSessions: vi.fn(),
    listAccessHistory: vi.fn(),
    ...overrides
  } as AdminStore;
}

async function expectAdminError(promise: Promise<unknown>, code: string, status: number) {
  try {
    await promise;
    throw new Error("A operação deveria ser recusada");
  } catch (error) {
    expect(error).toBeInstanceOf(PublicAdminError);
    expect(error).toMatchObject({ code, status });
  }
}

describe("autorização administrativa no backend", () => {
  it("nega a listagem quando o usuário não possui a permissão", async () => {
    const service = new AdminService(store([]), config);
    await expectAdminError(
      service.listUnits(session(), { search: "", type: null, status: null, page: 1, pageSize: 10 }),
      "PERMISSAO_NEGADA",
      403
    );
  });

  it("não confia no ID de unidade enviado por um usuário de Matriz", async () => {
    const fakeStore = store(["UNIDADES_VISUALIZAR"], {
      getUnit: vi.fn().mockResolvedValue(unit({ id: 200, matrixId: 200 }))
    });
    const service = new AdminService(fakeStore, config);
    await expectAdminError(
      service.getUnit(session({ scope: "MATRIZ", boundMatrixId: 100 }), "MATRIZ", 200),
      "UNIDADE_NAO_ENCONTRADA",
      404
    );
  });

  it("impede criação de outra Convenção mesmo com permissão funcional", async () => {
    const service = new AdminService(store(["UNIDADES_CRIAR"]), config);
    await expectAdminError(
      service.createUnit(session(), { type: "CONVENCAO", name: "Outra Convencao" }, metadata),
      "ESCOPO_CONVENCAO_LIMITADO",
      403
    );
  });

  it("não permite conceder uma permissão que o próprio administrador não possui", async () => {
    const service = new AdminService(store(["USUARIOS_CRIAR"]), config);
    await expectAdminError(
      service.createUser(
        session(),
        {
          name: "Novo Usuario",
          username: "novo.usuario",
          email: "novo@example.com",
          cpf: "529.982.247-25",
          roleName: "Secretario",
          scope: "CONVENCAO",
          temporaryPassword: "SenhaForte1234",
          permissions: ["USUARIOS_EDITAR"]
        },
        metadata
      ),
      "PERMISSAO_NAO_DELEGAVEL",
      403
    );
  });

  it("Matriz não altera usuário de outra matriz", async () => {
    const fakeStore = store(["USUARIOS_DESATIVAR"], {
      getUser: vi.fn().mockResolvedValue(user({ boundMatrixId: 200 }))
    });
    const service = new AdminService(fakeStore, config);
    await expectAdminError(
      service.setUserStatus(
        session({ scope: "MATRIZ", boundMatrixId: 100 }),
        8,
        "INATIVO",
        metadata
      ),
      "USUARIO_NAO_ENCONTRADO",
      404
    );
  });

  it("bloqueia redefinição administrativa da própria senha", async () => {
    const fakeStore = store(["USUARIOS_REDEFINIR_SENHA"], {
      getUser: vi.fn().mockResolvedValue(user({ id: 1, scope: "CONVENCAO", boundMatrixId: null }))
    });
    const service = new AdminService(fakeStore, config);
    await expectAdminError(
      service.resetUserPassword(session(), 1, "SenhaForte1234", metadata),
      "AUTOALTERACAO_BLOQUEADA",
      409
    );
  });
});

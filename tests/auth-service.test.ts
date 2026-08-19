import { beforeAll, describe, expect, it } from "vitest";
import type { AuthConfig } from "@/lib/auth/config";
import { hashSessionToken } from "@/lib/auth/crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { AuthService, PublicAuthError } from "@/lib/auth/service";
import type { RequestMetadata } from "@/lib/auth/types";
import { FakeAuthStore, type FakeUser } from "@/tests/fake-auth-store";

const config: AuthConfig = {
  databaseUrl: "mysql://test:test@localhost:3306/test",
  sessionHmacKey: "session-key-for-tests-with-32-characters",
  cpfLookupHmacKey: "cpf-lookup-key-for-tests-with-32-chars",
  auditHmacKey: "audit-key-for-tests-with-more-than-32-chars",
  appOrigin: "http://localhost:3000",
  sessionTtlHours: 12,
  maxAttempts: 3,
  blockMinutes: 15,
  cookieSecure: false
};

const metadata: RequestMetadata = {
  ipHash: "a".repeat(64),
  originSummary: "Chrome em Android",
  userAgent: "Mozilla/5.0 Test"
};

let validPasswordHash: string;

function baseUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    id: 12,
    conventionId: 10,
    name: "Quilson Lira",
    username: "quilson",
    roleName: "Administrador",
    status: "ATIVO",
    scope: "CONVENCAO",
    boundMatrixId: null,
    boundBranchId: null,
    passwordHash: validPasswordHash,
    failedAttempts: 0,
    blockedUntil: null,
    sessionVersion: 1,
    mustChangePassword: false,
    testCpf: "52998224725",
    testEmail: "quilson@example.com",
    ...overrides
  };
}

function setup(overrides: Partial<FakeUser> = {}) {
  const store = new FakeAuthStore();
  const user = baseUser(overrides);
  store.users.push(user);
  store.conventions = [{ id: 10, name: "Convencao de Teste", status: "ATIVO" }];
  store.matrices = [
    { id: 1, conventionId: 10, name: "Matriz Breu Branco", status: "ATIVO" },
    { id: 2, conventionId: 10, name: "Matriz Tucurui", status: "ATIVO" }
  ];
  store.branches = [
    { id: 11, matrixId: 1, name: "Fonte de Luz", status: "ATIVO" },
    { id: 12, matrixId: 1, name: "Nova Jerusalem", status: "ATIVO" },
    { id: 21, matrixId: 2, name: "Filial Tucurui", status: "ATIVO" }
  ];
  return { store, user, service: new AuthService(store, config) };
}

async function expectLoginRejected(promise: Promise<unknown>, status?: number) {
  try {
    await promise;
    throw new Error("O login deveria ter sido recusado");
  } catch (error) {
    expect(error).toBeInstanceOf(PublicAuthError);
    expect((error as PublicAuthError).publicMessage).toContain("Não foi possível entrar");
    if (status) expect((error as PublicAuthError).status).toBe(status);
  }
}

beforeAll(async () => {
  validPasswordHash = await hashPassword("SenhaMuitoForte123");
});

describe("autenticacao", () => {
  it("entra por CPF valido formatado ou sem formatacao", async () => {
    const first = setup();
    expect((await first.service.login("529.982.247-25", "SenhaMuitoForte123", metadata)).payload.user.id).toBe(12);

    const second = setup();
    expect((await second.service.login("52998224725", "SenhaMuitoForte123", metadata)).payload.user.id).toBe(12);
    expect(second.store.lookupTypes).toEqual(["CPF"]);
  });

  it("entra por usuario exato sem diferenca de maiusculas", async () => {
    const { service, store } = setup();
    const result = await service.login("QUILSON", "SenhaMuitoForte123", metadata);
    expect(result.payload.user.username).toBe("quilson");
    expect(store.lookupTypes).toEqual(["USUARIO"]);
  });

  it("entra por e-mail exato sem diferenca de maiusculas", async () => {
    const { service, store } = setup();
    await service.login("Quilson@Example.COM", "SenhaMuitoForte123", metadata);
    expect(store.lookupTypes).toEqual(["EMAIL"]);
  });

  it("classifica primeiro e consulta somente a coluna correspondente", async () => {
    const { service, store } = setup();
    await service.login("quilson", "SenhaMuitoForte123", metadata);
    expect(store.lookupTypes).toEqual(["USUARIO"]);
  });

  it("nao autentica ID interno nem pesquisa parcial", async () => {
    const internalId = setup();
    await expectLoginRejected(internalId.service.login("12", "SenhaMuitoForte123", metadata));
    expect(internalId.store.lookupTypes).toEqual([]);

    const partial = setup();
    await expectLoginRejected(partial.service.login("quil", "SenhaMuitoForte123", metadata));
    expect(partial.store.lookupTypes).toEqual(["USUARIO"]);
  });

  it("rejeita CPF invalido antes da consulta", async () => {
    const { service, store } = setup();
    await expectLoginRejected(service.login("529.982.247-24", "SenhaMuitoForte123", metadata));
    expect(store.lookupTypes).toEqual([]);
    expect(store.audits.at(-1)?.internalReason).toBe("CPF_INVALIDO");
  });

  it("rejeita senha incorreta, vazia e nao altera seus caracteres", async () => {
    const wrong = setup();
    await expectLoginRejected(wrong.service.login("quilson", "errada", metadata));
    expect(wrong.user.failedAttempts).toBe(1);

    const empty = setup();
    await expectLoginRejected(empty.service.login("quilson", "", metadata));

    const spaced = setup();
    await expectLoginRejected(spaced.service.login("quilson", " SenhaMuitoForte123 ", metadata));
  });

  it("rejeita campos vazios com mensagem generica", async () => {
    const { service } = setup();
    await expectLoginRejected(service.login("", "", metadata));
  });

  it.each(["INATIVO", "EX_USUARIO", "BLOQUEADO"] as const)(
    "rejeita conta com status %s no servico",
    async (status) => {
      const { service, store } = setup({ status });
      await expectLoginRejected(service.login("quilson", "SenhaMuitoForte123", metadata));
      expect(store.audits.at(-1)?.internalReason).toBe(`STATUS_${status}`);
    }
  );

  it("aplica bloqueio temporario no banco logico apos tentativas consecutivas", async () => {
    const { service, user } = setup();
    await expectLoginRejected(service.login("quilson", "errada", metadata), 401);
    await expectLoginRejected(service.login("quilson", "errada", metadata), 401);
    await expectLoginRejected(service.login("quilson", "errada", metadata), 429);
    expect(user.blockedUntil).toBeInstanceOf(Date);
    await expectLoginRejected(service.login("quilson", "SenhaMuitoForte123", metadata), 429);
  });

  it("zera o contador depois de um login bem-sucedido", async () => {
    const { service, user } = setup();
    await expectLoginRejected(service.login("quilson", "errada", metadata));
    expect(user.failedAttempts).toBe(1);
    await service.login("quilson", "SenhaMuitoForte123", metadata);
    expect(user.failedAttempts).toBe(0);
    expect(user.blockedUntil).toBeNull();
  });

  it("retorna o ultimo login anterior, nunca o acesso que acabou de gravar", async () => {
    const { service, store } = setup();
    store.lastAccessByUser.set(12, {
      dateTime: "2026-08-05T22:42:00.000Z",
      identifierType: "EMAIL",
      originSummary: "Chrome em Android"
    });
    const result = await service.login("quilson", "SenhaMuitoForte123", metadata);
    expect(result.payload.lastPreviousAccess).toEqual({
      dateTime: "2026-08-05T22:42:00.000Z",
      identifierType: "EMAIL",
      originSummary: "Chrome em Android"
    });
    expect(store.lastAccessByUser.get(12)?.identifierType).toBe("USUARIO");
  });

  it("registra corretamente o tipo de identificador sem guardar o valor aberto", async () => {
    const { service, store } = setup();
    await service.login("quilson@example.com", "SenhaMuitoForte123", metadata);
    const audit = store.audits.at(-1);
    expect(audit?.identifierType).toBe("EMAIL");
    expect(audit?.protectedIdentifier).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(audit)).not.toContain("quilson@example.com");
  });

  it("nao devolve senha, hash, CPF, e-mail ou token dentro da sessao segura", async () => {
    const { service } = setup();
    const result = await service.login("quilson", "SenhaMuitoForte123", metadata);
    const serialized = JSON.stringify(result.payload);
    expect(serialized).not.toContain("senha");
    expect(serialized).not.toContain(validPasswordHash);
    expect(serialized).not.toContain("52998224725");
    expect(serialized).not.toContain("quilson@example.com");
    expect(serialized).not.toContain(result.sessionToken);
  });
});

describe("sessao e contextos", () => {
  it("bloqueia consulta sem sessao valida", async () => {
    const { service } = setup();
    await expect(service.me("sessao-inexistente")).rejects.toMatchObject({
      code: "SESSAO_INVALIDA",
      status: 401
    });
  });

  it("Convencao lista e troca para matriz e filial autorizadas", async () => {
    const { service, store } = setup();
    const login = await service.login("quilson", "SenhaMuitoForte123", metadata);
    expect(login.payload.activeContext).toBeNull();
    const contexts = await service.availableContexts(login.sessionToken);
    expect(contexts.matrices.map((matrix) => matrix.id)).toEqual([1, 2]);
    const changed = await service.changeContext(login.sessionToken, 1, 11, metadata);
    expect(changed.activeContext).toMatchObject({ matrixId: 1, branchId: 11 });
    expect(store.audits.at(-1)?.event).toBe("TROCA_CONTEXTO");
  });

  it("Matriz lista apenas suas filiais e nao aceita outra matriz", async () => {
    const { service } = setup({ scope: "MATRIZ", boundMatrixId: 1 });
    const login = await service.login("quilson", "SenhaMuitoForte123", metadata);
    const contexts = await service.availableContexts(login.sessionToken);
    expect(contexts.matrices.map((matrix) => matrix.id)).toEqual([1]);
    expect(contexts.branches.map((branch) => branch.id)).toEqual([11, 12]);
    await expect(
      service.changeContext(login.sessionToken, 2, 21, metadata)
    ).rejects.toMatchObject({ code: "ACESSO_NEGADO", status: 403 });
  });

  it("Filial recebe contexto fixo e nao troca por chamada manual", async () => {
    const { service, store } = setup({
      scope: "FILIAL",
      boundBranchId: 11,
      boundMatrixId: null
    });
    const login = await service.login("quilson", "SenhaMuitoForte123", metadata);
    expect(login.payload.activeContext).toMatchObject({ matrixId: 1, branchId: 11 });
    await expect(
      service.changeContext(login.sessionToken, 1, 12, metadata)
    ).rejects.toMatchObject({ code: "ACESSO_NEGADO", status: 403 });
    expect(store.audits.at(-1)?.event).toBe("ACESSO_FORA_ESCOPO");
  });

  it("impede troca de contexto enquanto a senha temporaria nao for alterada", async () => {
    const { service } = setup({ mustChangePassword: true });
    const login = await service.login("quilson", "SenhaMuitoForte123", metadata);
    await expect(service.changeContext(login.sessionToken, 1, null, metadata)).rejects.toMatchObject({
      code: "TROCA_SENHA_OBRIGATORIA",
      status: 403
    });
  });

  it("logout revoga a sessao e registra auditoria", async () => {
    const { service, store } = setup();
    const login = await service.login("quilson", "SenhaMuitoForte123", metadata);
    await service.logout(login.sessionToken, metadata);
    expect(store.sessions.has(hashSessionToken(login.sessionToken, config.sessionHmacKey))).toBe(false);
    expect(store.audits.at(-1)?.event).toBe("LOGOUT");
  });

  it("troca a senha, revoga sessoes anteriores e exige novo login", async () => {
    const { service, user, store } = setup({ mustChangePassword: true });
    const login = await service.login("quilson", "SenhaMuitoForte123", metadata);
    await service.changePassword(
      login.sessionToken,
      "SenhaMuitoForte123",
      "NovaSenhaMuitoForte456",
      metadata
    );
    expect(store.sessions.size).toBe(0);
    expect(user.mustChangePassword).toBe(false);
    expect(await verifyPassword(user.passwordHash, "NovaSenhaMuitoForte456")).toBe(true);
    expect(store.audits.map((audit) => audit.event)).toContain("SESSAO_REVOGADA");
    await expect(service.me(login.sessionToken)).rejects.toMatchObject({ code: "SESSAO_INVALIDA" });
  });
});

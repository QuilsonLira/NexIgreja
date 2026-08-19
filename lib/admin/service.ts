import { getAuthConfig, type AuthConfig } from "@/lib/auth/config";
import { cpfLookupHash } from "@/lib/auth/crypto";
import { classifyIdentifier, InvalidIdentifierError } from "@/lib/auth/identifier";
import { hashPassword, validateNewPassword } from "@/lib/auth/password";
import type {
  AuthenticatedSession,
  OrganizationalScope,
  RequestMetadata
} from "@/lib/auth/types";
import {
  PERMISSION_DEFINITIONS,
  type PermissionCode
} from "@/lib/admin/permissions";
import { canAdministerUnit, canAdministerUser } from "@/lib/admin/scope";
import { AdminStoreConflictError, type AdminStore } from "@/lib/admin/store";
import type {
  AccessListQuery,
  AdminBootstrap,
  AdminUnitStatus,
  AdminUnitType,
  PersistedUserInput,
  UnitListQuery,
  UserListQuery,
  UserWriteInput
} from "@/lib/admin/types";

export class PublicAdminError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "PublicAdminError";
  }
}

function cleanName(value: string, label: string, max = 150): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > max) {
    throw new PublicAdminError(
      "DADOS_INVALIDOS",
      400,
      `${label} deve ter entre 2 e ${max} caracteres.`
    );
  }
  return normalized;
}

function assertNotMandatoryPassword(session: AuthenticatedSession): void {
  if (session.user.mustChangePassword) {
    throw new PublicAdminError(
      "TROCA_SENHA_OBRIGATORIA",
      403,
      "Troque a senha temporária antes de acessar a administração."
    );
  }
}

function conflictToPublic(error: unknown): never {
  if (error instanceof AdminStoreConflictError) {
    const messages = {
      username: "Este nome de usuário já está em uso.",
      email: "Este e-mail já está em uso.",
      cpf: "Este CPF já está cadastrado.",
      unitName: "Já existe uma unidade com este nome nesse vínculo."
    } as const;
    throw new PublicAdminError("REGISTRO_DUPLICADO", 409, messages[error.field]);
  }
  throw error;
}

export class AdminService {
  constructor(
    private readonly store: AdminStore,
    private readonly config: AuthConfig = getAuthConfig()
  ) {}

  private async permissions(session: AuthenticatedSession): Promise<Set<PermissionCode>> {
    return new Set(await this.store.listPermissions(session.user.id));
  }

  private async requirePermission(
    session: AuthenticatedSession,
    permission: PermissionCode
  ): Promise<Set<PermissionCode>> {
    assertNotMandatoryPassword(session);
    const permissions = await this.permissions(session);
    if (!permissions.has(permission)) {
      throw new PublicAdminError(
        "PERMISSAO_NEGADA",
        403,
        "Você não possui permissão para realizar esta operação."
      );
    }
    return permissions;
  }

  private assertAssignablePermissions(
    actorPermissions: Set<PermissionCode>,
    requested: PermissionCode[]
  ): void {
    if (new Set(requested).size !== requested.length) {
      throw new PublicAdminError("DADOS_INVALIDOS", 400, "Há permissões repetidas no cadastro.");
    }
    if (requested.some((permission) => !actorPermissions.has(permission))) {
      throw new PublicAdminError(
        "PERMISSAO_NAO_DELEGAVEL",
        403,
        "Você não pode conceder uma permissão que não possui."
      );
    }
  }

  async bootstrap(session: AuthenticatedSession): Promise<AdminBootstrap> {
    const [permissions, unitOptions] = await Promise.all([
      this.store.listPermissions(session.user.id),
      this.store.listUnitOptions(session.user)
    ]);
    const allowedUserScopes: OrganizationalScope[] =
      session.user.scope === "CONVENCAO"
        ? ["CONVENCAO", "MATRIZ", "FILIAL"]
        : session.user.scope === "MATRIZ"
          ? ["MATRIZ", "FILIAL"]
          : ["FILIAL"];
    const creatableUnitTypes: AdminUnitType[] =
      session.user.scope === "CONVENCAO"
        ? ["MATRIZ", "FILIAL"]
        : session.user.scope === "MATRIZ"
          ? ["FILIAL"]
          : [];

    return {
      permissions,
      permissionDefinitions: PERMISSION_DEFINITIONS.map((definition) => ({ ...definition })),
      unitOptions,
      allowedUserScopes,
      creatableUnitTypes
    };
  }

  async listUnits(session: AuthenticatedSession, query: UnitListQuery) {
    await this.requirePermission(session, "UNIDADES_VISUALIZAR");
    return this.store.listUnits(session.user, query);
  }

  async getUnit(session: AuthenticatedSession, type: AdminUnitType, id: number) {
    await this.requirePermission(session, "UNIDADES_VISUALIZAR");
    const unit = await this.store.getUnit(type, id);
    if (!unit || !canAdministerUnit(session.user, unit)) {
      throw new PublicAdminError("UNIDADE_NAO_ENCONTRADA", 404, "Unidade não encontrada.");
    }
    return unit;
  }

  async createUnit(
    session: AuthenticatedSession,
    input: { type: AdminUnitType; name: string; matrixId?: number | null },
    metadata: RequestMetadata
  ) {
    await this.requirePermission(session, "UNIDADES_CRIAR");
    const name = cleanName(input.name, "O nome da unidade");

    if (input.type === "CONVENCAO") {
      throw new PublicAdminError(
        "ESCOPO_CONVENCAO_LIMITADO",
        403,
        "Sua conta pode administrar apenas a própria convenção."
      );
    }

    try {
      if (input.type === "MATRIZ") {
        if (session.user.scope !== "CONVENCAO") {
          throw new PublicAdminError(
            "ESCOPO_NEGADO",
            403,
            "Somente um acesso da Convenção pode cadastrar uma matriz."
          );
        }
        return await this.store.createMatrix(
          session.user,
          session.user.conventionId,
          name,
          metadata
        );
      }

      const matrixId = input.matrixId ?? null;
      if (!matrixId) {
        throw new PublicAdminError("DADOS_INVALIDOS", 400, "Selecione a matriz da filial.");
      }
      const matrix = await this.store.getUnit("MATRIZ", matrixId);
      if (!matrix || matrix.status !== "ATIVO" || !canAdministerUnit(session.user, matrix)) {
        throw new PublicAdminError("MATRIZ_INVALIDA", 400, "A matriz selecionada não está disponível.");
      }
      if (session.user.scope === "FILIAL") {
        throw new PublicAdminError(
          "ESCOPO_NEGADO",
          403,
          "Um acesso de Filial não pode cadastrar outras unidades."
        );
      }
      return await this.store.createBranch(session.user, matrixId, name, metadata);
    } catch (error) {
      conflictToPublic(error);
    }
  }

  async updateUnit(
    session: AuthenticatedSession,
    type: AdminUnitType,
    id: number,
    input: { name: string; matrixId?: number | null },
    metadata: RequestMetadata
  ) {
    await this.requirePermission(session, "UNIDADES_EDITAR");
    const unit = await this.store.getUnit(type, id);
    if (!unit || !canAdministerUnit(session.user, unit)) {
      throw new PublicAdminError("UNIDADE_NAO_ENCONTRADA", 404, "Unidade não encontrada.");
    }
    const name = cleanName(input.name, "O nome da unidade");
    let matrixId = unit.matrixId;

    if (unit.type === "FILIAL" && input.matrixId && input.matrixId !== unit.matrixId) {
      const matrix = await this.store.getUnit("MATRIZ", input.matrixId);
      if (!matrix || matrix.status !== "ATIVO" || !canAdministerUnit(session.user, matrix)) {
        throw new PublicAdminError("MATRIZ_INVALIDA", 400, "A nova matriz não está disponível.");
      }
      matrixId = matrix.id;
    }

    try {
      return await this.store.updateUnit(session.user, unit, name, matrixId, metadata);
    } catch (error) {
      conflictToPublic(error);
    }
  }

  async setUnitStatus(
    session: AuthenticatedSession,
    type: AdminUnitType,
    id: number,
    status: AdminUnitStatus,
    metadata: RequestMetadata
  ) {
    await this.requirePermission(session, "UNIDADES_EDITAR");
    const unit = await this.store.getUnit(type, id);
    if (!unit || !canAdministerUnit(session.user, unit)) {
      throw new PublicAdminError("UNIDADE_NAO_ENCONTRADA", 404, "Unidade não encontrada.");
    }

    if (status === "INATIVO") {
      const isCurrentConvention = unit.type === "CONVENCAO" && unit.id === session.user.conventionId;
      const isCurrentMatrix = unit.type === "MATRIZ" && unit.id === session.activeContext?.matrixId;
      const isCurrentBranch = unit.type === "FILIAL" && unit.id === session.activeContext?.branchId;
      const isBoundMatrix = unit.type === "MATRIZ" && unit.id === session.user.boundMatrixId;
      const isBoundBranch = unit.type === "FILIAL" && unit.id === session.user.boundBranchId;
      if (isCurrentConvention || isCurrentMatrix || isCurrentBranch || isBoundMatrix || isBoundBranch) {
        throw new PublicAdminError(
          "UNIDADE_EM_USO",
          409,
          "Não é possível desativar a unidade usada pela sua própria sessão."
        );
      }
    } else if (unit.type === "MATRIZ") {
      const convention = await this.store.getUnit("CONVENCAO", unit.conventionId);
      if (!convention || convention.status !== "ATIVO") {
        throw new PublicAdminError("UNIDADE_PAI_INATIVA", 409, "Ative a convenção antes da matriz.");
      }
    } else if (unit.type === "FILIAL" && unit.matrixId) {
      const matrix = await this.store.getUnit("MATRIZ", unit.matrixId);
      if (!matrix || matrix.status !== "ATIVO") {
        throw new PublicAdminError("UNIDADE_PAI_INATIVA", 409, "Ative a matriz antes da filial.");
      }
    }

    return this.store.setUnitStatus(session.user, unit, status, metadata);
  }

  async listUsers(session: AuthenticatedSession, query: UserListQuery) {
    await this.requirePermission(session, "USUARIOS_VISUALIZAR");
    return this.store.listUsers(session.user, query);
  }

  async getUser(session: AuthenticatedSession, id: number) {
    await this.requirePermission(session, "USUARIOS_VISUALIZAR");
    const user = await this.store.getUser(id);
    if (!user || !canAdministerUser(session.user, user)) {
      throw new PublicAdminError("USUARIO_NAO_ENCONTRADO", 404, "Usuário não encontrado.");
    }
    return user;
  }

  private async normalizeUserInput(
    session: AuthenticatedSession,
    input: UserWriteInput,
    actorPermissions: Set<PermissionCode>,
    isCreate: boolean
  ): Promise<PersistedUserInput> {
    const name = cleanName(input.name, "O nome");
    const roleName = cleanName(input.roleName, "A função", 100);

    let username;
    let email;
    try {
      username = classifyIdentifier(input.username);
      email = classifyIdentifier(input.email);
    } catch (error) {
      const message =
        error instanceof InvalidIdentifierError && error.reason.startsWith("EMAIL")
          ? "Informe um e-mail válido."
          : "Informe um nome de usuário válido.";
      throw new PublicAdminError("DADOS_INVALIDOS", 400, message);
    }
    if (username.type !== "USUARIO") {
      throw new PublicAdminError("DADOS_INVALIDOS", 400, "Informe um nome de usuário válido.");
    }
    if (email.type !== "EMAIL") {
      throw new PublicAdminError("DADOS_INVALIDOS", 400, "Informe um e-mail válido.");
    }

    this.assertAssignablePermissions(actorPermissions, input.permissions);
    const binding = await this.validateUserBinding(session, input.scope, input.matrixId, input.branchId);
    const persisted: PersistedUserInput = {
      conventionId: session.user.conventionId,
      name,
      username: username.normalized,
      email: email.normalized,
      roleName,
      scope: input.scope,
      matrixId: binding.matrixId,
      branchId: binding.branchId,
      permissions: input.permissions
    };

    if (input.cpf?.trim()) {
      let cpf;
      try {
        cpf = classifyIdentifier(input.cpf);
      } catch {
        throw new PublicAdminError("DADOS_INVALIDOS", 400, "Informe um CPF válido.");
      }
      if (cpf.type !== "CPF") {
        throw new PublicAdminError("DADOS_INVALIDOS", 400, "Informe um CPF válido.");
      }
      persisted.cpfLookupHash = cpfLookupHash(cpf.normalized, this.config.cpfLookupHmacKey);
      persisted.cpfLastDigits = cpf.normalized.slice(-2);
    } else if (isCreate) {
      throw new PublicAdminError("DADOS_INVALIDOS", 400, "Informe o CPF do usuário.");
    }

    return persisted;
  }

  private async validateUserBinding(
    session: AuthenticatedSession,
    scope: OrganizationalScope,
    matrixId?: number | null,
    branchId?: number | null
  ): Promise<{ matrixId: number | null; branchId: number | null }> {
    if (scope === "CONVENCAO") {
      if (session.user.scope !== "CONVENCAO") {
        throw new PublicAdminError("ESCOPO_NEGADO", 403, "Você não pode criar um acesso de Convenção.");
      }
      return { matrixId: null, branchId: null };
    }

    if (scope === "MATRIZ") {
      if (!matrixId) {
        throw new PublicAdminError("DADOS_INVALIDOS", 400, "Selecione a matriz do usuário.");
      }
      const matrix = await this.store.getUnit("MATRIZ", matrixId);
      if (!matrix || matrix.status !== "ATIVO" || !canAdministerUnit(session.user, matrix)) {
        throw new PublicAdminError("MATRIZ_INVALIDA", 400, "A matriz selecionada não está disponível.");
      }
      return { matrixId, branchId: null };
    }

    if (!branchId) {
      throw new PublicAdminError("DADOS_INVALIDOS", 400, "Selecione a filial do usuário.");
    }
    const branch = await this.store.getUnit("FILIAL", branchId);
    if (!branch || branch.status !== "ATIVO" || !canAdministerUnit(session.user, branch)) {
      throw new PublicAdminError("FILIAL_INVALIDA", 400, "A filial selecionada não está disponível.");
    }
    return { matrixId: null, branchId };
  }

  async createUser(
    session: AuthenticatedSession,
    input: UserWriteInput,
    metadata: RequestMetadata
  ) {
    const actorPermissions = await this.requirePermission(session, "USUARIOS_CRIAR");
    const persisted = await this.normalizeUserInput(session, input, actorPermissions, true);
    const temporaryPassword = input.temporaryPassword ?? "";
    const passwordErrors = validateNewPassword(temporaryPassword);
    if (passwordErrors.length) {
      throw new PublicAdminError("SENHA_TEMPORARIA_FRACA", 400, passwordErrors.join(" "));
    }
    persisted.passwordHash = await hashPassword(temporaryPassword);

    try {
      return await this.store.createUser(
        session.user,
        persisted as Required<
          Pick<PersistedUserInput, "cpfLookupHash" | "cpfLastDigits" | "passwordHash">
        > &
          PersistedUserInput,
        metadata
      );
    } catch (error) {
      conflictToPublic(error);
    }
  }

  async updateUser(
    session: AuthenticatedSession,
    id: number,
    input: UserWriteInput,
    metadata: RequestMetadata
  ) {
    const actorPermissions = await this.requirePermission(session, "USUARIOS_EDITAR");
    const target = await this.store.getUser(id);
    if (!target || !canAdministerUser(session.user, target)) {
      throw new PublicAdminError("USUARIO_NAO_ENCONTRADO", 404, "Usuário não encontrado.");
    }
    if (target.id === session.user.id) {
      throw new PublicAdminError(
        "AUTOEDICAO_BLOQUEADA",
        409,
        "Use as configurações da conta para alterar seu próprio cadastro."
      );
    }
    const persisted = await this.normalizeUserInput(session, input, actorPermissions, false);
    persisted.permissions = Array.from(
      new Set([
        ...persisted.permissions,
        ...target.permissions.filter((permission) => !actorPermissions.has(permission))
      ])
    );
    try {
      return await this.store.updateUser(session.user, target, persisted, metadata);
    } catch (error) {
      conflictToPublic(error);
    }
  }

  async setUserStatus(
    session: AuthenticatedSession,
    id: number,
    status: "ATIVO" | "INATIVO",
    metadata: RequestMetadata
  ) {
    await this.requirePermission(session, "USUARIOS_DESATIVAR");
    const target = await this.store.getUser(id);
    if (!target || !canAdministerUser(session.user, target)) {
      throw new PublicAdminError("USUARIO_NAO_ENCONTRADO", 404, "Usuário não encontrado.");
    }
    if (target.id === session.user.id) {
      throw new PublicAdminError("AUTOALTERACAO_BLOQUEADA", 409, "Você não pode desativar sua própria conta.");
    }
    if (status === "ATIVO") {
      await this.validateUserBinding(
        session,
        target.scope,
        target.boundMatrixId,
        target.boundBranchId
      );
    }
    return this.store.setUserStatus(session.user, target, status, metadata);
  }

  async resetUserPassword(
    session: AuthenticatedSession,
    id: number,
    temporaryPassword: string,
    metadata: RequestMetadata
  ) {
    await this.requirePermission(session, "USUARIOS_REDEFINIR_SENHA");
    const target = await this.store.getUser(id);
    if (!target || !canAdministerUser(session.user, target)) {
      throw new PublicAdminError("USUARIO_NAO_ENCONTRADO", 404, "Usuário não encontrado.");
    }
    if (target.id === session.user.id) {
      throw new PublicAdminError(
        "AUTOALTERACAO_BLOQUEADA",
        409,
        "Use a opção Trocar minha senha para sua própria conta."
      );
    }
    const errors = validateNewPassword(temporaryPassword);
    if (errors.length) {
      throw new PublicAdminError("SENHA_TEMPORARIA_FRACA", 400, errors.join(" "));
    }
    await this.store.resetUserPassword(
      session.user,
      target,
      await hashPassword(temporaryPassword),
      metadata
    );
  }

  async revokeUserSessions(
    session: AuthenticatedSession,
    id: number,
    metadata: RequestMetadata
  ) {
    await this.requirePermission(session, "USUARIOS_REDEFINIR_SENHA");
    const target = await this.store.getUser(id);
    if (!target || !canAdministerUser(session.user, target)) {
      throw new PublicAdminError("USUARIO_NAO_ENCONTRADO", 404, "Usuário não encontrado.");
    }
    if (target.id === session.user.id) {
      throw new PublicAdminError(
        "AUTOALTERACAO_BLOQUEADA",
        409,
        "Use o botão Sair para encerrar sua própria sessão."
      );
    }
    return this.store.revokeUserSessions(session.user, target, metadata);
  }

  async listAccessHistory(session: AuthenticatedSession, query: AccessListQuery) {
    await this.requirePermission(session, "ACESSOS_VISUALIZAR");
    return this.store.listAccessHistory(session.user, query);
  }
}

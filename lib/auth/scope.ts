import type {
  ActiveContext,
  AvailableContexts,
  BranchRecord,
  ConventionRecord,
  MatrixRecord,
  OrganizationalUser
} from "@/lib/auth/types";

export interface UnitDirectory {
  getConventionById(conventionId: number): Promise<ConventionRecord | null>;
  getMatrixById(matrixId: number): Promise<MatrixRecord | null>;
  getBranchById(branchId: number): Promise<BranchRecord | null>;
  listActiveMatrices(conventionId: number): Promise<MatrixRecord[]>;
  listActiveBranches(matrixIds: number[]): Promise<BranchRecord[]>;
}

async function assertActiveConvention(
  directory: UnitDirectory,
  conventionId: number
): Promise<void> {
  const convention = await directory.getConventionById(conventionId);
  if (!convention || convention.status !== "ATIVO") {
    throw new InvalidOrganizationalBindingError("CONVENCAO_INATIVA_OU_INEXISTENTE");
  }
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  context: ActiveContext | null;
}

export class InvalidOrganizationalBindingError extends Error {
  constructor(public readonly reason: string) {
    super("Vinculo organizacional invalido");
    this.name = "InvalidOrganizationalBindingError";
  }
}

async function validateMatrix(
  directory: UnitDirectory,
  conventionId: number,
  matrixId: number
): Promise<MatrixRecord | null> {
  const matrix = await directory.getMatrixById(matrixId);
  if (!matrix || matrix.status !== "ATIVO" || matrix.conventionId !== conventionId) return null;
  return matrix;
}

export async function canAccessUnit(
  user: OrganizationalUser,
  matrixId: number,
  branchId: number | null,
  directory: UnitDirectory
): Promise<AccessDecision> {
  try {
    await assertActiveConvention(directory, user.conventionId);
  } catch {
    return { allowed: false, reason: "CONVENCAO_INATIVA_OU_INEXISTENTE", context: null };
  }
  const matrix = await validateMatrix(directory, user.conventionId, matrixId);
  if (!matrix) return { allowed: false, reason: "MATRIZ_INVALIDA_OU_FORA_CONVENCAO", context: null };

  let branch: BranchRecord | null = null;
  if (branchId !== null) {
    branch = await directory.getBranchById(branchId);
    if (!branch || branch.status !== "ATIVO" || branch.matrixId !== matrix.id) {
      return { allowed: false, reason: "FILIAL_INVALIDA_OU_FORA_MATRIZ", context: null };
    }
  }

  if (user.scope === "CONVENCAO") {
    return {
      allowed: true,
      reason: "ESCOPO_CONVENCAO",
      context: {
        matrixId: matrix.id,
        branchId: branch?.id ?? null,
        unitName: branch?.name ?? matrix.name,
        unitType: branch ? "FILIAL" : "MATRIZ"
      }
    };
  }

  if (user.scope === "MATRIZ") {
    if (user.boundMatrixId !== matrix.id) {
      return { allowed: false, reason: "MATRIZ_DIFERENTE_DO_VINCULO", context: null };
    }
    return {
      allowed: true,
      reason: "ESCOPO_MATRIZ",
      context: {
        matrixId: matrix.id,
        branchId: branch?.id ?? null,
        unitName: branch?.name ?? matrix.name,
        unitType: branch ? "FILIAL" : "MATRIZ"
      }
    };
  }

  if (branchId === null || user.boundBranchId !== branchId) {
    return { allowed: false, reason: "FILIAL_DIFERENTE_DO_VINCULO", context: null };
  }
  if (!branch) {
    return { allowed: false, reason: "FILIAL_INVALIDA_OU_FORA_MATRIZ", context: null };
  }

  return {
    allowed: true,
    reason: "ESCOPO_FILIAL",
    context: {
      matrixId: matrix.id,
      branchId: branch.id,
      unitName: branch.name,
      unitType: "FILIAL"
    }
  };
}

export async function resolveInitialContext(
  user: OrganizationalUser,
  directory: UnitDirectory
): Promise<ActiveContext | null> {
  await assertActiveConvention(directory, user.conventionId);
  if (user.scope === "CONVENCAO") {
    const matrices = await directory.listActiveMatrices(user.conventionId);
    if (matrices.length !== 1) return null;
    const [matrix] = matrices;
    return {
      matrixId: matrix.id,
      branchId: null,
      unitName: matrix.name,
      unitType: "MATRIZ"
    };
  }

  if (user.scope === "MATRIZ") {
    if (user.boundMatrixId === null || user.boundBranchId !== null) {
      throw new InvalidOrganizationalBindingError("VINCULO_MATRIZ_INCONSISTENTE");
    }
    const decision = await canAccessUnit(user, user.boundMatrixId, null, directory);
    if (!decision.allowed) throw new InvalidOrganizationalBindingError(decision.reason);
    return decision.context;
  }

  if (user.boundBranchId === null || user.boundMatrixId !== null) {
    throw new InvalidOrganizationalBindingError("VINCULO_FILIAL_INCONSISTENTE");
  }
  const branch = await directory.getBranchById(user.boundBranchId);
  if (!branch) throw new InvalidOrganizationalBindingError("FILIAL_VINCULADA_INEXISTENTE");
  const decision = await canAccessUnit(user, branch.matrixId, branch.id, directory);
  if (!decision.allowed) throw new InvalidOrganizationalBindingError(decision.reason);
  return decision.context;
}

export async function listAvailableContexts(
  user: OrganizationalUser,
  directory: UnitDirectory
): Promise<AvailableContexts> {
  await assertActiveConvention(directory, user.conventionId);
  if (user.scope === "CONVENCAO") {
    const matrices = await directory.listActiveMatrices(user.conventionId);
    const branches = await directory.listActiveBranches(matrices.map((matrix) => matrix.id));
    return {
      fixedMatrixId: null,
      matrices: matrices.map(({ id, name }) => ({ id, name })),
      branches: branches.map(({ id, matrixId, name }) => ({ id, matrixId, name })),
      canChangeMatrix: true,
      canChangeBranch: true
    };
  }

  if (user.scope === "MATRIZ") {
    if (user.boundMatrixId === null) {
      throw new InvalidOrganizationalBindingError("MATRIZ_SEM_VINCULO");
    }
    const decision = await canAccessUnit(user, user.boundMatrixId, null, directory);
    if (!decision.allowed || !decision.context) {
      throw new InvalidOrganizationalBindingError(decision.reason);
    }
    const branches = await directory.listActiveBranches([user.boundMatrixId]);
    return {
      fixedMatrixId: user.boundMatrixId,
      matrices: [{ id: user.boundMatrixId, name: decision.context.unitName }],
      branches: branches.map(({ id, matrixId, name }) => ({ id, matrixId, name })),
      canChangeMatrix: false,
      canChangeBranch: true
    };
  }

  if (user.boundBranchId === null) {
    throw new InvalidOrganizationalBindingError("FILIAL_SEM_VINCULO");
  }
  const branch = await directory.getBranchById(user.boundBranchId);
  if (!branch) throw new InvalidOrganizationalBindingError("FILIAL_VINCULADA_INEXISTENTE");
  const decision = await canAccessUnit(user, branch.matrixId, branch.id, directory);
  if (!decision.allowed || !decision.context) {
    throw new InvalidOrganizationalBindingError(decision.reason);
  }
  const matrix = await directory.getMatrixById(branch.matrixId);
  if (!matrix) throw new InvalidOrganizationalBindingError("MATRIZ_DA_FILIAL_INEXISTENTE");

  return {
    fixedMatrixId: matrix.id,
    matrices: [{ id: matrix.id, name: matrix.name }],
    branches: [{ id: branch.id, matrixId: matrix.id, name: branch.name }],
    canChangeMatrix: false,
    canChangeBranch: false
  };
}

export type DependencyCount = { source: string; count: number };

export function platformOwnerStatus(isPlatformOwner: boolean): 200 | 403 {
  return isPlatformOwner ? 200 : 403;
}

export function canUseOrganizationalAdministration(isPlatformOwner: boolean, platformContextActive: boolean): boolean {
  return !isPlatformOwner || platformContextActive;
}

export function permanentDeletionPhrase(unitName: string): string {
  return `EXCLUIR ${unitName}`;
}

export function userPermanentDeletionPhrase(userName: string): string {
  return `EXCLUIR ${userName}`;
}

export function canArchiveEntity(status: "ATIVO" | "INATIVO"): boolean {
  return status === "INATIVO";
}

export function canDeleteOwnAccount(actorId: number, targetId: number): boolean {
  return actorId !== targetId;
}

export function hasBlockingDependencies(dependencies: readonly DependencyCount[]): boolean {
  return dependencies.some((dependency) => dependency.count > 0);
}

export function archivedUnitState(status: "ATIVO" | "INATIVO"): { status: "INATIVO"; previousStatus: "ATIVO" | "INATIVO" } {
  return { status: "INATIVO", previousStatus: status };
}

export function restoredUnitStatus(previousStatus: string | null): "ATIVO" | "INATIVO" {
  return previousStatus === "ATIVO" ? "ATIVO" : "INATIVO";
}

export function isConventionCreationAllowed(isPlatformOwner: boolean): boolean {
  return isPlatformOwner;
}

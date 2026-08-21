export type MembershipState = "ATIVO" | "INATIVO" | "PENDENTE";

export interface MembershipCandidate {
  id: number;
  userId: number;
  tenantId: number;
  status: MembershipState;
  archived: boolean;
  tenantOperational: boolean;
  scopeOperational: boolean;
}

export function isUsableMembership(candidate: MembershipCandidate, allowPending = false): boolean {
  return candidate.tenantOperational
    && candidate.scopeOperational
    && !candidate.archived
    && (candidate.status === "ATIVO" || (allowPending && candidate.status === "PENDENTE"));
}

export function canActivateMembership(identityId: number, candidate: MembershipCandidate): boolean {
  return candidate.userId === identityId && isUsableMembership(candidate);
}

export function requiresOrganizationSelection(memberships: readonly { membershipStatus: MembershipState }[]): boolean {
  return memberships.length > 1 || memberships.some((membership) => membership.membershipStatus === "PENDENTE");
}

export function membershipPermissions<T extends string>(
  membershipId: number,
  assignments: readonly { membershipId: number; permission: T }[],
): T[] {
  return assignments.filter((item) => item.membershipId === membershipId).map((item) => item.permission);
}

export const FUNCTION_NAME_MAX_LENGTH = 100;
export const FUNCTION_DESCRIPTION_MAX_LENGTH = 500;

export function normalizedFunctionName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function cleanFunctionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= FUNCTION_NAME_MAX_LENGTH ? name : null;
}

export function canSelectFunction(status: string, functionTenantId: number, activeTenantId: number): boolean {
  return status === "ATIVO" && functionTenantId === activeTenantId;
}

import type { MemberWriteInput } from "@/lib/members/types";

/**
 * Mantém o nome completo de membros em um único padrão para cadastros,
 * listagens e relatórios administrativos.
 */
export function normalizeMemberWriteInput(input: MemberWriteInput): MemberWriteInput {
  return {
    ...input,
    fullName:
      typeof input.fullName === "string"
        ? input.fullName.toLocaleUpperCase("pt-BR")
        : input.fullName,
  };
}

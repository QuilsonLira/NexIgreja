import { ApiError, database } from "@/lib/server/auth";

export type FinanceCategoryKind = "RECEITA" | "DESPESA";

export type ValidatedFinanceCategory = {
  id: number;
  name: string;
  kind: FinanceCategoryKind;
  participates_allocation: number;
  requires_fund: number;
};

export async function validateFinanceCategory(options: {
  tenantId: number;
  categoryId: number | null;
  expectedKind: FinanceCategoryKind;
  fundId?: number | null;
  enforceFund?: boolean;
  required?: boolean;
}): Promise<ValidatedFinanceCategory | null> {
  if (!options.categoryId) {
    if (options.required) {
      throw new ApiError(
        400,
        "CATEGORIA_OBRIGATORIA",
        "Selecione uma Categoria Financeira para este lançamento.",
      );
    }
    return null;
  }

  const category = await database()
    .prepare(
      "SELECT id,name,kind,participates_allocation,requires_fund,status,archived_at FROM finance_categories WHERE id=? AND tenant_id=?",
    )
    .bind(options.categoryId, options.tenantId)
    .first<ValidatedFinanceCategory & { status: string; archived_at: string | null }>();

  if (!category || category.status !== "ATIVA" || category.archived_at) {
    throw new ApiError(
      400,
      "CATEGORIA_INVALIDA",
      "Selecione uma Categoria Financeira ativa deste cliente.",
    );
  }
  if (category.kind !== options.expectedKind) {
    throw new ApiError(
      400,
      "NATUREZA_CATEGORIA_INVALIDA",
      options.expectedKind === "RECEITA"
        ? "A Categoria Financeira precisa ser do tipo Receita."
        : "A Categoria Financeira precisa ser do tipo Despesa.",
    );
  }
  if (options.enforceFund !== false && Number(category.requires_fund) === 1 && !options.fundId) {
    throw new ApiError(
      400,
      "FUNDO_OBRIGATORIO",
      "Esta Categoria Financeira exige um Fundo vinculado.",
    );
  }
  return category;
}

export interface PublicErrorClassification {
  status: 409 | 500 | 503;
  code: "CONFLITO_INTEGRIDADE" | "MIGRATION_PENDENTE" | "ERRO_INTERNO" | "BANCO_INDISPONIVEL";
  message: string;
}

export function classifyUnexpectedError(error: unknown): PublicErrorClassification {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/foreign key constraint failed|unique constraint failed|not null constraint failed|check constraint failed|SQLITE_CONSTRAINT/i.test(message)) {
    return {
      status: 409,
      code: "CONFLITO_INTEGRIDADE",
      message: "A operação foi impedida porque existem dados vinculados. Preserve o registro arquivado ou remova primeiro as dependências permitidas.",
    };
  }

  if (/no such (?:table|column)|has no column named|duplicate column name|SQLITE_SCHEMA/i.test(message)) {
    return {
      status: 500,
      code: "MIGRATION_PENDENTE",
      message: "A estrutura do banco de dados precisa ser atualizada antes de concluir esta operação.",
    };
  }

  if (/binding.+(?:missing|not found|undefined)|database.+unavailable|connection.+(?:failed|refused|closed)|timed? ?out|storage.+unavailable|D1_SERVICE_ERROR/i.test(message)) {
    return {
      status: 503,
      code: "BANCO_INDISPONIVEL",
      message: "Banco de dados indisponível. Tente novamente em instantes.",
    };
  }

  return { status: 500, code: "ERRO_INTERNO", message: "Não foi possível concluir a solicitação." };
}

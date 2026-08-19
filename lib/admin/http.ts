import type { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http/api-response";
import { clearSessionCookie, readSessionToken } from "@/lib/http/session-cookie";
import { getAuthService } from "@/lib/auth";
import { PublicAuthError } from "@/lib/auth/service";
import { PublicAdminError } from "@/lib/admin/service";

export async function requireAdminSession(request: NextRequest) {
  const token = readSessionToken(request);
  if (!token) {
    throw new PublicAuthError("SESSAO_AUSENTE", 401, "Entre para continuar.");
  }
  return getAuthService().getSession(token);
}

function isDatabaseUnavailable(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "PROTOCOL_CONNECTION_LOST",
    "ER_CON_COUNT_ERROR"
  ].includes(code ?? "");
}

export function adminErrorResponse(error: unknown) {
  let response;
  if (error instanceof PublicAdminError || error instanceof PublicAuthError) {
    response = noStoreJson(
      { error: { code: error.code, message: error.publicMessage } },
      { status: error.status }
    );
  } else if (isDatabaseUnavailable(error)) {
    response = noStoreJson(
      {
        error: {
          code: "BANCO_INDISPONIVEL",
          message: "O sistema está temporariamente indisponível. Tente novamente em instantes."
        }
      },
      { status: 503 }
    );
  } else {
    response = noStoreJson(
      { error: { code: "ERRO_INTERNO", message: "Não foi possível concluir a solicitação." } },
      { status: 500 }
    );
  }
  if (response.status === 401) clearSessionCookie(response);
  return response;
}

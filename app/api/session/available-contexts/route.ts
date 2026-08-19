import type { NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth";
import { authErrorResponse, noStoreJson } from "@/lib/http/api-response";
import { clearSessionCookie, readSessionToken } from "@/lib/http/session-cookie";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = readSessionToken(request);
  if (!token) {
    return noStoreJson(
      { error: { code: "SESSAO_AUSENTE", message: "Entre para continuar." } },
      { status: 401 }
    );
  }

  try {
    return noStoreJson({
      ok: true,
      contexts: await getAuthService().availableContexts(token)
    });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response.status === 401) clearSessionCookie(response);
    return response;
  }
}

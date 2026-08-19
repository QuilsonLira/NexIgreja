import type { NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth";
import { noStoreJson } from "@/lib/http/api-response";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { clearSessionCookie, readSessionToken } from "@/lib/http/session-cookie";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const token = readSessionToken(request);
    if (token) await getAuthService().logout(token, getRequestMetadata(request));
    const response = noStoreJson({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson(
        { error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } },
        { status: 403 }
      );
    }
    const response = noStoreJson(
      { error: { code: "ERRO_INTERNO", message: "Não foi possível encerrar a sessão." } },
      { status: 500 }
    );
    clearSessionCookie(response);
    return response;
  }
}

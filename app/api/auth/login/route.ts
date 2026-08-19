import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthService } from "@/lib/auth";
import { authErrorResponse, noStoreJson } from "@/lib/http/api-response";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { setSessionCookie } from "@/lib/http/session-cookie";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  identifier: z.string().max(254),
  password: z.string().max(128)
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        { error: { code: "DADOS_INVALIDOS", message: "Preencha seu acesso e sua senha." } },
        { status: 400 }
      );
    }

    const result = await getAuthService().login(
      parsed.data.identifier,
      parsed.data.password,
      getRequestMetadata(request)
    );
    const response = noStoreJson({ ok: true, session: result.payload });
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson(
        { error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } },
        { status: 403 }
      );
    }
    return authErrorResponse(error);
  }
}

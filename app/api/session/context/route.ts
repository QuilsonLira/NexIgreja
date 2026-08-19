import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthService } from "@/lib/auth";
import { authErrorResponse, noStoreJson } from "@/lib/http/api-response";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { clearSessionCookie, readSessionToken } from "@/lib/http/session-cookie";

export const dynamic = "force-dynamic";

const contextSchema = z.object({
  matrixId: z.number().int().positive(),
  branchId: z.number().int().positive().nullable().optional()
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const token = readSessionToken(request);
    if (!token) {
      return noStoreJson(
        { error: { code: "SESSAO_AUSENTE", message: "Entre para continuar." } },
        { status: 401 }
      );
    }

    const parsed = contextSchema.safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        { error: { code: "CONTEXTO_INVALIDO", message: "Escolha uma unidade valida." } },
        { status: 400 }
      );
    }

    const session = await getAuthService().changeContext(
      token,
      parsed.data.matrixId,
      parsed.data.branchId ?? null,
      getRequestMetadata(request)
    );
    return noStoreJson({ ok: true, session });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson(
        { error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } },
        { status: 403 }
      );
    }
    const response = authErrorResponse(error);
    if (response.status === 401) clearSessionCookie(response);
    return response;
  }
}

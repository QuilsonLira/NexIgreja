import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthService } from "@/lib/auth";
import { authErrorResponse, noStoreJson } from "@/lib/http/api-response";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { clearSessionCookie, readSessionToken } from "@/lib/http/session-cookie";

export const dynamic = "force-dynamic";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().max(128),
    newPassword: z.string().max(128),
    confirmPassword: z.string().max(128)
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"]
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

    const parsed = changePasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        {
          error: {
            code: "DADOS_INVALIDOS",
            message: parsed.error.issues[0]?.message ?? "Confira os campos informados."
          }
        },
        { status: 400 }
      );
    }

    await getAuthService().changePassword(
      token,
      parsed.data.currentPassword,
      parsed.data.newPassword,
      getRequestMetadata(request)
    );
    const response = noStoreJson({
      ok: true,
      message: "Senha alterada. Entre novamente com a nova senha."
    });
    clearSessionCookie(response);
    return response;
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

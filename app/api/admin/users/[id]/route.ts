import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { userWriteSchema } from "@/lib/admin/validation";
import { assertTrustedOrigin, UntrustedOriginError } from "@/lib/http/csrf";
import { getRequestMetadata } from "@/lib/http/request-meta";
import { noStoreJson } from "@/lib/http/api-response";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

async function userId(context: RouteContext): Promise<number | null> {
  const id = Number((await context.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const id = await userId(context);
    if (!id) return noStoreJson({ error: { code: "DADOS_INVALIDOS", message: "Usuário inválido." } }, { status: 400 });
    const session = await requireAdminSession(request);
    return noStoreJson({ ok: true, user: await getAdminService().getUser(session, id) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertTrustedOrigin(request);
    const id = await userId(context);
    const body = userWriteSchema.omit({ temporaryPassword: true }).safeParse(await request.json());
    if (!id || !body.success) {
      return noStoreJson(
        { error: { code: "DADOS_INVALIDOS", message: "Revise os dados do usuário." } },
        { status: 400 }
      );
    }
    const session = await requireAdminSession(request);
    const user = await getAdminService().updateUser(session, id, body.data, getRequestMetadata(request));
    return noStoreJson({ ok: true, user, message: "Usuário atualizado com sucesso." });
  } catch (error) {
    if (error instanceof UntrustedOriginError) {
      return noStoreJson({ error: { code: "ORIGEM_NAO_AUTORIZADA", message: "Solicitação não autorizada." } }, { status: 403 });
    }
    return adminErrorResponse(error);
  }
}

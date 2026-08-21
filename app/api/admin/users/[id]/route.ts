import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { getAdminUser, updateAdminUser } from "@/lib/server/admin";
import type { OrganizationalScope } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";

type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  try {
    const id = positiveId((await context.params).id);
    return adminJson({ ok: true, user: await getAdminUser(request, id) });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const id = positiveId((await context.params).id);
    const body = await adminBody(request);
    if (!["name", "username", "email", "scope"].every((key) => typeof body[key] === "string") || !Number.isInteger(Number(body.functionId)) || !Array.isArray(body.permissions)) {
      throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados do usuário.");
    }
    const user = await updateAdminUser(request, id, {
      name: body.name as string,
      username: body.username as string,
      email: body.email as string,
      cpf: typeof body.cpf === "string" ? body.cpf : undefined,
      functionId: Number(body.functionId),
      scope: body.scope as OrganizationalScope,
      matrixId: body.matrixId === null || body.matrixId === undefined ? null : Number(body.matrixId),
      branchId: body.branchId === null || body.branchId === undefined ? null : Number(body.branchId),
      permissions: body.permissions as PermissionCode[],
    });
    return adminJson({ ok: true, user, message: "Usuário atualizado. As sessões anteriores foram encerradas para aplicar as novas permissões." });
  } catch (error) {
    return adminRouteError(error);
  }
}

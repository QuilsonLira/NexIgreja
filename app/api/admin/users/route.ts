import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { createAdminUser, listAdminUsers } from "@/lib/server/admin";
import type { OrganizationalScope } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return adminJson({ ok: true, result: await listAdminUsers(request, Object.fromEntries(params)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await adminBody(request);
    if (!["name", "username", "email", "cpf", "scope", "temporaryPassword"].every((key) => typeof body[key] === "string") || !Number.isInteger(Number(body.functionId)) || !Array.isArray(body.permissions)) {
      throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados do usuário.");
    }
    const user = await createAdminUser(request, {
      name: body.name as string,
      username: body.username as string,
      email: body.email as string,
      cpf: body.cpf as string,
      functionId: Number(body.functionId),
      scope: body.scope as OrganizationalScope,
      matrixId: body.matrixId === null || body.matrixId === undefined ? null : Number(body.matrixId),
      branchId: body.branchId === null || body.branchId === undefined ? null : Number(body.branchId),
      temporaryPassword: body.temporaryPassword as string,
      permissions: body.permissions as PermissionCode[],
    });
    return adminJson({ ok: true, user, message: "Usuário e credencial exclusivos desta organização cadastrados com sucesso." }, 201);
  } catch (error) {
    return adminRouteError(error);
  }
}

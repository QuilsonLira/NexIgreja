import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { resetAdminUserPassword } from "@/lib/server/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    await resetAdminUserPassword(request, positiveId((await context.params).id));
    return adminJson({ ok: true, message: "As sessões deste acesso foram encerradas. A senha desta organização não afeta acessos do usuário em outros tenants." });
  } catch (error) {
    return adminRouteError(error);
  }
}

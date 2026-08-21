import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { updateOrganizationalFunction } from "@/lib/server/organizational-functions";
type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: RouteContext) { try { const organizationalFunction = await updateOrganizationalFunction(request, positiveId((await context.params).id), await adminBody(request)); return adminJson({ ok: true, function: organizationalFunction, message: "Função atualizada com sucesso." }); } catch (error) { return adminRouteError(error); } }

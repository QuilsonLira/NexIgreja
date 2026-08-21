import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { setOrganizationalFunctionStatus } from "@/lib/server/organizational-functions";
type RouteContext = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: RouteContext) { try { const body = await adminBody(request); if (body.status !== "ATIVO" && body.status !== "INATIVO") throw new ApiError(400, "DADOS_INVALIDOS", "Status inválido."); const organizationalFunction = await setOrganizationalFunctionStatus(request, positiveId((await context.params).id), body.status); return adminJson({ ok: true, function: organizationalFunction, message: body.status === "ATIVO" ? "Função ativada." : "Função desativada. Os vínculos históricos foram preservados." }); } catch (error) { return adminRouteError(error); } }

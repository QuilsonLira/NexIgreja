import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { createOrganizationalFunction, listOrganizationalFunctions } from "@/lib/server/organizational-functions";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { return adminJson({ ok: true, functions: await listOrganizationalFunctions(request) }); } catch (error) { return adminRouteError(error); } }
export async function POST(request: Request) { try { const organizationalFunction = await createOrganizationalFunction(request, await adminBody(request)); return adminJson({ ok: true, function: organizationalFunction, message: "Função cadastrada com sucesso." }, 201); } catch (error) { return adminRouteError(error); } }

import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { regenerateInstitutionCode } from "@/lib/server/platform";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await adminBody(request);
    const tenant = await regenerateInstitutionCode(request, positiveId((await context.params).id), body.confirmed === true);
    return adminJson({ ok: true, tenant, message: "Novo código gerado. O código anterior deixou de identificar esta instituição." });
  } catch (error) { return adminRouteError(error); }
}

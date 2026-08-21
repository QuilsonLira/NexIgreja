import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { createPlatformTenant, listPlatformTenants } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return adminJson({ ok: true, result: await listPlatformTenants(request, Object.fromEntries(new URL(request.url).searchParams)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await createPlatformTenant(request, await adminBody(request));
    return adminJson({ ok: true, tenant, message: "Cliente cadastrado com sucesso." }, 201);
  } catch (error) {
    return adminRouteError(error);
  }
}

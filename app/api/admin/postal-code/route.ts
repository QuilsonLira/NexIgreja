import { adminJson, adminRouteError } from "@/lib/admin/http";
import { requireAnyPermission } from "@/lib/server/admin";
import { lookupPostalCode } from "@/lib/server/postal-code";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ["MEMBROS_CRIAR", "MEMBROS_EDITAR"]);
    return adminJson({
      ok: true,
      address: await lookupPostalCode(
        new URL(request.url).searchParams.get("postalCode"),
      ),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}

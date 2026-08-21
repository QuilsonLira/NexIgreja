import { adminJson, adminRouteError } from "@/lib/admin/http";
import { leaveTenantAdministration } from "@/lib/server/platform";

export async function DELETE(request: Request) {
  try {
    await leaveTenantAdministration(request);
    return adminJson({ ok: true, message: "Você voltou à Administração do NexIgreja." });
  } catch (error) { return adminRouteError(error); }
}

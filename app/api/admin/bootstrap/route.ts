import { adminJson, adminRouteError } from "@/lib/admin/http";
import { adminBootstrap } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return adminJson({ ok: true, admin: await adminBootstrap(request) });
  } catch (error) {
    return adminRouteError(error);
  }
}

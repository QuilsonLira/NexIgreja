import { adminJson, adminRouteError } from "@/lib/admin/http";
import { listArchivedPlatformUsers } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return adminJson({ ok: true, result: await listArchivedPlatformUsers(request, Object.fromEntries(new URL(request.url).searchParams)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

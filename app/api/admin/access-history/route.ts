import { adminJson, adminRouteError } from "@/lib/admin/http";
import { listAccessHistory } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return adminJson({ ok: true, result: await listAccessHistory(request, Object.fromEntries(params)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

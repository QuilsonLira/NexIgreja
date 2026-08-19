import type { NextRequest } from "next/server";
import { getAdminService } from "@/lib/admin";
import { adminErrorResponse, requireAdminSession } from "@/lib/admin/http";
import { noStoreJson } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession(request);
    return noStoreJson({ ok: true, admin: await getAdminService().bootstrap(session) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

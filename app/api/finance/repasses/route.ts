import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import {
  financeRepasses,
  financeRepassOperation,
} from "@/lib/server/finance-repasses";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return adminJson({ ok: true, result: await financeRepasses(request) });
  } catch (error) {
    return adminRouteError(error);
  }
}
export async function POST(request: Request) {
  try {
    return adminJson({
      ok: true,
      result: await financeRepassOperation(request, await adminBody(request)),
    });
  } catch (error) {
    return adminRouteError(error);
  }
}

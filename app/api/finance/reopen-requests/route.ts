import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { createPeriodReopenRequest, decidePeriodReopenRequest } from "@/lib/server/finance-periods";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return adminJson({ ok: true, result: await createPeriodReopenRequest(request, await adminBody(request)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return adminJson({ ok: true, result: await decidePeriodReopenRequest(request, await adminBody(request)) });
  } catch (error) {
    return adminRouteError(error);
  }
}

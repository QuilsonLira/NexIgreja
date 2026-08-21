import { ApiError } from "@/lib/server/auth";
import { adminBody, adminJson, adminRouteError, unitWriteFields } from "@/lib/admin/http";
import { createPlatformConvention, listPlatformConventions } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    return adminJson({ ok: true, result: await listPlatformConventions(request, params) });
  } catch (error) {
    return adminRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await adminBody(request);
    if (typeof body.name !== "string") throw new ApiError(400, "DADOS_INVALIDOS", "Revise os dados da Convenção.");
    const convention = await createPlatformConvention(request, unitWriteFields(body));
    return adminJson({ ok: true, convention, message: "Convenção cadastrada com sucesso." }, 201);
  } catch (error) {
    return adminRouteError(error);
  }
}

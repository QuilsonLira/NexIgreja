import { currentInstitution, errorResponse } from "@/lib/server/auth";
import { publicConventionLogo, storedImageResponse } from "@/lib/server/media";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const institution = await currentInstitution(request);
    if (!institution) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return storedImageResponse(await publicConventionLogo(institution.id), "private, max-age=60");
  } catch (error) {
    return errorResponse(error);
  }
}

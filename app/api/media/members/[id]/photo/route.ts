import { adminRouteError,positiveId } from "@/lib/admin/http";
import { storedImageResponse } from "@/lib/server/media";
import { readMemberPhoto } from "@/lib/server/members";
type C={params:Promise<{id:string}>};export const dynamic="force-dynamic";
export async function GET(request:Request,c:C){try{return storedImageResponse(await readMemberPhoto(request,positiveId((await c.params).id)));}catch(error){return adminRouteError(error);}}

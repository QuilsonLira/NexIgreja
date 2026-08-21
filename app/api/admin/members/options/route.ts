import { adminJson,adminRouteError } from "@/lib/admin/http";
import { memberOptions } from "@/lib/server/members";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,options:await memberOptions(request)});}catch(error){return adminRouteError(error);}}

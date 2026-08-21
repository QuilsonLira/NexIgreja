import { adminJson,adminRouteError } from "@/lib/admin/http";
import { tenantBillingDetail } from "@/lib/server/commercial";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,detail:await tenantBillingDetail(request)});}catch(error){return adminRouteError(error);}}

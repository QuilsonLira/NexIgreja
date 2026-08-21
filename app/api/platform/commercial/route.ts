import { adminJson,adminRouteError } from "@/lib/admin/http";
import { commercialDashboard } from "@/lib/server/commercial";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,dashboard:await commercialDashboard(request)});}catch(error){return adminRouteError(error);}}

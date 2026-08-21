import { adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { quickSessionData } from "@/lib/server/finance-periods";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,result:await quickSessionData(request,positiveId((await params).id))});}catch(error){return adminRouteError(error);}}

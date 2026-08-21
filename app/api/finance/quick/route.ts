import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { quickSessionOperation, quickSessionSetup, startQuickSession } from "@/lib/server/finance-periods";
import { positiveId } from "@/lib/admin/http";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await quickSessionSetup(request,positiveId(new URL(request.url).searchParams.get("periodId")||""))});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{const body=await adminBody(request);return adminJson({ok:true,result:await (body.action==="START"?startQuickSession(request,body):quickSessionOperation(request,body))});}catch(error){return adminRouteError(error);}}

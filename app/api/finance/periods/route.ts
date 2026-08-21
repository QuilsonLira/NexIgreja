import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { financePeriodWorkspace, periodOperation, updateReopenedPeriodRules } from "@/lib/server/finance-periods";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await financePeriodWorkspace(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,result:await periodOperation(request,await adminBody(request))});}catch(error){return adminRouteError(error);}}
export async function PUT(request:Request){try{return adminJson({ok:true,result:await updateReopenedPeriodRules(request,await adminBody(request))});}catch(error){return adminRouteError(error);}}

import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { createFinanceRecord, financeOverview } from "@/lib/server/finance";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await financeOverview(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,result:await createFinanceRecord(request,await adminBody(request))},201);}catch(error){return adminRouteError(error);}}

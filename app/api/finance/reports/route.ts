import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { financeReportOperation, financeReportsWorkspace } from "@/lib/server/finance-reports";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await financeReportsWorkspace(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,result:await financeReportOperation(request,await adminBody(request))});}catch(error){return adminRouteError(error);}}

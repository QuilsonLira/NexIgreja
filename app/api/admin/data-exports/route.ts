import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { exportData,exportHistory } from "@/lib/server/data-export";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await exportHistory(request)});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return await exportData(request,await adminBody(request));}catch(error){return adminRouteError(error);}}

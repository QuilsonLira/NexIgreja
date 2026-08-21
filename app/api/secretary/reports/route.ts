import {adminJson,adminRouteError} from "@/lib/admin/http";
import {secretaryReport} from "@/lib/server/secretary";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await secretaryReport(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}

import {adminJson,adminRouteError,positiveId} from "@/lib/admin/http";
import {departmentReport} from "@/lib/server/departments";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,result:await departmentReport(request,positiveId((await params).id),Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}

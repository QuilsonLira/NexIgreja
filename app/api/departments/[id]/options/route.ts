import {adminJson,adminRouteError,positiveId} from "@/lib/admin/http";
import {departmentOptions} from "@/lib/server/departments";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,result:await departmentOptions(request,positiveId((await params).id),Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}

import {adminBody,adminJson,adminRouteError,positiveId} from "@/lib/admin/http";
import {departmentOperation} from "@/lib/server/departments";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,...await departmentOperation(request,positiveId((await params).id),await adminBody(request))});}catch(error){return adminRouteError(error);}}

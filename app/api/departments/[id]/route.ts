import {adminBody,adminJson,adminRouteError,positiveId} from "@/lib/admin/http";
import {departmentOperation,departmentOverview} from "@/lib/server/departments";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,result:await departmentOverview(request,positiveId((await params).id))});}catch(error){return adminRouteError(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,...await departmentOperation(request,positiveId((await params).id),{...await adminBody(request),action:"updateDepartment"})});}catch(error){return adminRouteError(error);}}

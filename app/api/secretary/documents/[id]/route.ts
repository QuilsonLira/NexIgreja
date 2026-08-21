import {adminJson,adminRouteError} from "@/lib/admin/http";
import {secretaryDocument} from "@/lib/server/secretary";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,result:await secretaryDocument(request,Number((await params).id))});}catch(error){return adminRouteError(error);}}

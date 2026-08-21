import { adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { getPreRegistration } from "@/lib/server/pre-registration";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,detail:await getPreRegistration(request,positiveId((await params).id))});}catch(error){return adminRouteError(error);}}

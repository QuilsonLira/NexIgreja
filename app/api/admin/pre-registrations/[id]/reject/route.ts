import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { rejectPreRegistration } from "@/lib/server/pre-registration";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const body=await adminBody(request);return adminJson({ok:true,...await rejectPreRegistration(request,positiveId((await params).id),body.reason)});}catch(error){return adminRouteError(error);}}

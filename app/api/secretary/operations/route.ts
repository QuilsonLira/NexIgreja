import {adminBody,adminJson,adminRouteError} from "@/lib/admin/http";
import {secretaryOperation} from "@/lib/server/secretary";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{return adminJson({ok:true,...await secretaryOperation(request,await adminBody(request) as Record<string,unknown>)});}catch(error){return adminRouteError(error);}}

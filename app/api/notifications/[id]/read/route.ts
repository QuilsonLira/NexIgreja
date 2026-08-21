import {adminJson,adminRouteError,positiveId} from "@/lib/admin/http";
import {markNotificationRead} from "@/lib/server/notifications";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,...await markNotificationRead(request,positiveId((await params).id))});}catch(error){return adminRouteError(error);}}

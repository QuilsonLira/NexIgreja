import {adminJson,adminRouteError} from "@/lib/admin/http";
import {markAllNotificationsRead} from "@/lib/server/notifications";
export async function POST(request:Request){try{return adminJson({ok:true,...await markAllNotificationsRead(request)});}catch(error){return adminRouteError(error);}}

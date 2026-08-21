import {adminJson,adminRouteError} from "@/lib/admin/http";
import {unreadNotificationCount} from "@/lib/server/notifications";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,count:await unreadNotificationCount(request)});}catch(error){return adminRouteError(error);}}

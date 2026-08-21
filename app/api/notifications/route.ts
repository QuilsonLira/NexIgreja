import {adminJson,adminRouteError} from "@/lib/admin/http";
import {listNotifications} from "@/lib/server/notifications";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await listNotifications(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}

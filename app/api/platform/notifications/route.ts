import {adminBody,adminJson,adminRouteError} from "@/lib/admin/http";
import {dispatchSystemNotification} from "@/lib/server/notifications";
export async function POST(request:Request){try{return adminJson({ok:true,...await dispatchSystemNotification(request,await adminBody(request)),message:"Notificação do sistema enviada."});}catch(error){return adminRouteError(error);}}

import { adminRouteError, positiveId } from "@/lib/admin/http";
import { financeAttachment } from "@/lib/server/finance";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return await financeAttachment(request,positiveId((await params).id));}catch(error){return adminRouteError(error);}}

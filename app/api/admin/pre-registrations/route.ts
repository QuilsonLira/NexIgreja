import { adminJson,adminRouteError } from "@/lib/admin/http";
import { listPreRegistrations } from "@/lib/server/pre-registration";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,items:await listPreRegistrations(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}

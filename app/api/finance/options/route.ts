import { adminJson, adminRouteError } from "@/lib/admin/http";
import { financeOptions } from "@/lib/server/finance";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await financeOptions(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}

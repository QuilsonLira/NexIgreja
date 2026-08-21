import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { saveAllocationConfig } from "@/lib/server/finance-periods";
export async function PUT(request:Request){try{return adminJson({ok:true,result:await saveAllocationConfig(request,await adminBody(request))});}catch(error){return adminRouteError(error);}}

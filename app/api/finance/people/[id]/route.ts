import { adminBody, adminJson, adminRouteError, positiveId } from "@/lib/admin/http";
import { personFinance, updatePersonFinance } from "@/lib/server/finance";
type C={params:Promise<{id:string}>};
export const dynamic="force-dynamic";
export async function GET(request:Request,c:C){try{return adminJson({ok:true,result:await personFinance(request,positiveId((await c.params).id))});}catch(error){return adminRouteError(error);}}
export async function PATCH(request:Request,c:C){try{return adminJson({ok:true,result:await updatePersonFinance(request,positiveId((await c.params).id),await adminBody(request))});}catch(error){return adminRouteError(error);}}

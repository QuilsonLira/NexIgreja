import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { savePlan } from "@/lib/server/commercial";
type C={params:Promise<{id:string}>};
export async function PATCH(request:Request,c:C){try{return adminJson({ok:true,plan:await savePlan(request,positiveId((await c.params).id),await adminBody(request)),message:"Plano atualizado com sucesso."});}catch(error){return adminRouteError(error);}}

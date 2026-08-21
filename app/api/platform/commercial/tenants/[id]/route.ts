import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { commercialAction,commercialTenant,saveCommercialTenant } from "@/lib/server/commercial";
type C={params:Promise<{id:string}>}; export const dynamic="force-dynamic";
export async function GET(request:Request,c:C){try{return adminJson({ok:true,detail:await commercialTenant(request,positiveId((await c.params).id))});}catch(error){return adminRouteError(error);}}
export async function PATCH(request:Request,c:C){try{return adminJson({ok:true,detail:await saveCommercialTenant(request,positiveId((await c.params).id),await adminBody(request)),message:"Cadastro comercial atualizado."});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request,c:C){try{return adminJson({ok:true,detail:await commercialAction(request,positiveId((await c.params).id),await adminBody(request)),message:"Operação comercial concluída."});}catch(error){return adminRouteError(error);}}

import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { listPlans,savePlan } from "@/lib/server/commercial";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,plans:await listPlans(request)});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,plan:await savePlan(request,null,await adminBody(request)),message:"Plano criado com sucesso."},201);}catch(error){return adminRouteError(error);}}

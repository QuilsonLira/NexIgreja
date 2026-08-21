import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { getBillingSettings,saveBillingSettings } from "@/lib/server/commercial";
export async function GET(request:Request){try{return adminJson({ok:true,settings:await getBillingSettings(request)});}catch(error){return adminRouteError(error);}}
export async function PATCH(request:Request){try{return adminJson({ok:true,settings:await saveBillingSettings(request,await adminBody(request)),message:"Configurações de cobrança atualizadas."});}catch(error){return adminRouteError(error);}}

import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { createCustomField,listCustomFields } from "@/lib/server/member-custom-fields";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,fields:await listCustomFields(request)});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,field:await createCustomField(request,await adminBody(request)),message:"Campo criado com sucesso."},201);}catch(error){return adminRouteError(error);}}

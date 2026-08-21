import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { createPreRegistrationForm,listPreRegistrationForms } from "@/lib/server/pre-registration";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,forms:await listPreRegistrationForms(request)});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,form:await createPreRegistrationForm(request,await adminBody(request)),message:"Formulário criado. Copie o link agora: por segurança ele não será exibido novamente."},201);}catch(error){return adminRouteError(error);}}

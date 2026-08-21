import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { listPreRegistrationForms,updatePreRegistrationForm } from "@/lib/server/pre-registration";
import { ApiError } from "@/lib/server/auth";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const id=positiveId((await params).id),body=await adminBody(request);if(!(await listPreRegistrationForms(request)).some(form=>form.id===id))throw new ApiError(403,"FORA_DO_ESCOPO","Formulário fora do seu escopo.");return adminJson({ok:true,form:await updatePreRegistrationForm(request,id,body),message:"Formulário atualizado."});}catch(error){return adminRouteError(error);}}

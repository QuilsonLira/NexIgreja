import { adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { listPreRegistrationForms,rotatePreRegistrationToken } from "@/lib/server/pre-registration";
import { ApiError,assertTrustedOrigin } from "@/lib/server/auth";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{assertTrustedOrigin(request);const id=positiveId((await params).id);if(!(await listPreRegistrationForms(request)).some(form=>form.id===id))throw new ApiError(403,"FORA_DO_ESCOPO","Formulário fora do seu escopo.");return adminJson({ok:true,...await rotatePreRegistrationToken(request,id),message:"Novo link criado. O link anterior foi invalidado."});}catch(error){return adminRouteError(error);}}

import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { updateCustomField } from "@/lib/server/member-custom-fields";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{return adminJson({ok:true,field:await updateCustomField(request,positiveId((await params).id),await adminBody(request)),message:"Campo atualizado com sucesso."});}catch(error){return adminRouteError(error);}}

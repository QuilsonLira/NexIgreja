import { adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { readImageUpload } from "@/lib/server/media";
import { updateMemberPhoto } from "@/lib/server/members";
type C={params:Promise<{id:string}>};export const dynamic="force-dynamic";
export async function PUT(request:Request,c:C){try{const photoUrl=await updateMemberPhoto(request,positiveId((await c.params).id),await readImageUpload(request));return adminJson({ok:true,photoUrl,message:"Foto do membro atualizada."});}catch(error){return adminRouteError(error);}}
export async function DELETE(request:Request,c:C){try{await updateMemberPhoto(request,positiveId((await c.params).id),null);return adminJson({ok:true,photoUrl:null,message:"Foto do membro removida."});}catch(error){return adminRouteError(error);}}

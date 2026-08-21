import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { getMember,updateMember } from "@/lib/server/members";
import type { MemberWriteInput } from "@/lib/members/types";
type C={params:Promise<{id:string}>};export const dynamic="force-dynamic";
export async function GET(request:Request,c:C){try{const id=positiveId((await c.params).id);return adminJson({ok:true,detail:await getMember(request,id,new URL(request.url).searchParams.get("print")==="1")});}catch(error){return adminRouteError(error);}}
export async function PATCH(request:Request,c:C){try{const member=await updateMember(request,positiveId((await c.params).id),await adminBody(request) as unknown as MemberWriteInput);return adminJson({ok:true,member,message:"Membro atualizado com sucesso."});}catch(error){return adminRouteError(error);}}

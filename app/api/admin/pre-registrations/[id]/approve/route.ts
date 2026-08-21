import { adminBody,adminJson,adminRouteError,positiveId } from "@/lib/admin/http";
import { approvePreRegistration } from "@/lib/server/pre-registration";
import type { MemberWriteInput } from "@/lib/members/types";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const member=await approvePreRegistration(request,positiveId((await params).id),await adminBody(request) as unknown as MemberWriteInput);return adminJson({ok:true,member,message:`Pré-cadastro aprovado. Código do membro: ${member.memberCode}`});}catch(error){return adminRouteError(error);}}

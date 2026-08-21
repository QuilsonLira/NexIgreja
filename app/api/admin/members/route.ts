import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { createMember,listMembers } from "@/lib/server/members";
import type { MemberWriteInput } from "@/lib/members/types";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await listMembers(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{const member=await createMember(request,await adminBody(request) as unknown as MemberWriteInput);return adminJson({ok:true,member,message:`Membro cadastrado com sucesso. Código do membro: ${member.memberCode}`},201);}catch(error){return adminRouteError(error);}}

import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { markHelpRead,updateHelpArticle } from "@/lib/server/help";
const id=(p:Promise<{id:string}>)=>p.then(x=>Number(x.id));
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{await markHelpRead(request,await id(params));return adminJson({ok:true});}catch(error){return adminRouteError(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{await updateHelpArticle(request,await id(params),await adminBody(request));return adminJson({ok:true,message:"Artigo atualizado com sucesso."});}catch(error){return adminRouteError(error);}}

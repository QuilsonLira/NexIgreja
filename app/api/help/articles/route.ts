import { adminBody,adminJson,adminRouteError } from "@/lib/admin/http";
import { createHelpArticle,helpCenter } from "@/lib/server/help";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await helpCenter(request)});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{const article=await createHelpArticle(request,await adminBody(request));return adminJson({ok:true,article,message:"Artigo criado com sucesso."},201);}catch(error){return adminRouteError(error);}}

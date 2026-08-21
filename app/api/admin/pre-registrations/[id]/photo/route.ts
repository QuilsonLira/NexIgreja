import { adminRouteError,positiveId } from "@/lib/admin/http";
import { preRegistrationPhoto } from "@/lib/server/pre-registration";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return await preRegistrationPhoto(request,positiveId((await params).id));}catch(error){return adminRouteError(error);}}

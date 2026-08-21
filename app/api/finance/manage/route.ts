import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { manageFinanceRegistry } from "@/lib/server/finance";

export async function POST(request:Request){
  try{return adminJson({ok:true,result:await manageFinanceRegistry(request,await adminBody(request))});}
  catch(error){return adminRouteError(error);}
}

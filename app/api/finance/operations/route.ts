import { adminBody, adminJson, adminRouteError } from "@/lib/admin/http";
import { financeOperation } from "@/lib/server/finance";
import { financeStageTwoOperation, isFinanceStageTwoAction } from "@/lib/server/finance-stage-two";
export async function POST(request:Request){try{const body=await adminBody(request);return adminJson({ok:true,result:isFinanceStageTwoAction(body.action)?await financeStageTwoOperation(request,body):await financeOperation(request,body)});}catch(error){return adminRouteError(error);}}

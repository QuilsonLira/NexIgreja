import { adminJson, adminRouteError } from "@/lib/admin/http";
import { assertTrustedOrigin } from "@/lib/server/auth";
import { saveFinanceAttachment } from "@/lib/server/finance";
export async function POST(request:Request){try{assertTrustedOrigin(request);return adminJson({ok:true,result:await saveFinanceAttachment(request,await request.formData())},201);}catch(error){return adminRouteError(error);}}

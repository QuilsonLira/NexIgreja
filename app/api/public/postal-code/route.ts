import { errorResponse } from "@/lib/server/auth";
import { lookupPostalCode } from "@/lib/server/postal-code";
export async function GET(request:Request){try{return Response.json({ok:true,address:await lookupPostalCode(new URL(request.url).searchParams.get("postalCode"))},{headers:{"Cache-Control":"public, max-age=3600"}});}catch(error){return errorResponse(error);}}

import { ApiError } from "@/lib/server/auth";
import { lookupPostalCodeProvider,PostalCodeLookupError,type PostalAddress } from "@/lib/members/postal-code";
export type { PostalAddress };
export async function lookupPostalCode(value:unknown,fetcher:typeof fetch=fetch):Promise<PostalAddress>{try{return await lookupPostalCodeProvider(value,fetcher);}catch(error){if(error instanceof PostalCodeLookupError)throw new ApiError(error.status,error.code,error.message);throw error;}}

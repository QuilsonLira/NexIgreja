import {adminBody,adminJson,adminRouteError} from "@/lib/admin/http";
import {createDepartment,listDepartments} from "@/lib/server/departments";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return adminJson({ok:true,result:await listDepartments(request,Object.fromEntries(new URL(request.url).searchParams))});}catch(error){return adminRouteError(error);}}
export async function POST(request:Request){try{return adminJson({ok:true,...await createDepartment(request,await adminBody(request)),message:"Departamento criado."},201);}catch(error){return adminRouteError(error);}}

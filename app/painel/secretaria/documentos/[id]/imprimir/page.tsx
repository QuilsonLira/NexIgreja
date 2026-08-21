import {SecretaryDocumentPrint} from "@/components/secretary-document-print";
export default async function Page({params}:{params:Promise<{id:string}>}){return <SecretaryDocumentPrint id={Number((await params).id)}/>;}

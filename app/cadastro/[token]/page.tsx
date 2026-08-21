import type { Metadata } from "next";
import { PublicPreRegistration } from "@/components/public-pre-registration";
export const metadata:Metadata={title:"Pré-cadastro de membro",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){return <PublicPreRegistration token={(await params).token}/>;}

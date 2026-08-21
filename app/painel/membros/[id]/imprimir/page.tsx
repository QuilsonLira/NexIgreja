import type { Metadata } from "next";
import { MemberProfile } from "@/components/admin/member-profile";
export const metadata:Metadata={title:"Imprimir ficha de membro"};
export default async function PrintMemberPage({params}:{params:Promise<{id:string}>}){return <MemberProfile id={Number((await params).id)} printMode/>;}

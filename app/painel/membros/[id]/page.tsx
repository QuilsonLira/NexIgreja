import type { Metadata } from "next";
import { MemberProfile } from "@/components/admin/member-profile";
export const metadata:Metadata={title:"Ficha do membro"};
export default async function MemberPage({params}:{params:Promise<{id:string}>}){return <MemberProfile id={Number((await params).id)}/>;}

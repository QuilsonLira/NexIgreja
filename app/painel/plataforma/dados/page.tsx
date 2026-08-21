import type { Metadata } from "next";
import { PlatformDataManager } from "@/components/platform/platform-data-manager";
export const metadata:Metadata={title:"Dados e Backups"};
export default function PlatformDataPage(){return <PlatformDataManager/>;}

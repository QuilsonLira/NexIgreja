import type { Metadata } from "next";
import { DataExportManager } from "@/components/admin/data-export-manager";
export const metadata:Metadata={title:"Dados e Exportação"};
export default function DataExportPage(){return <DataExportManager/>;}

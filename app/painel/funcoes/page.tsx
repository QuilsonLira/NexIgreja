import type { Metadata } from "next";
import { FunctionsManager } from "@/components/admin/functions-manager";
export const metadata: Metadata = { title: "Funções" };
export default function FunctionsPage() { return <FunctionsManager />; }

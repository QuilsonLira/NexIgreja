import type { Metadata } from "next";
import { AccessHistoryManager } from "@/components/admin/access-history";

export const metadata: Metadata = { title: "Histórico de acessos" };

export default function AccessHistoryPage() {
  return <AccessHistoryManager />;
}

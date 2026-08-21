import type { Metadata } from "next";
import { ArchivedUnitsManager } from "@/components/platform/platform-units-manager";

export const metadata: Metadata = { title: "Administração do NexIgreja — Unidades arquivadas" };

export default function ArchivedUnitsPage() {
  return <ArchivedUnitsManager />;
}

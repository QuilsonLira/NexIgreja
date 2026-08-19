import type { Metadata } from "next";
import { UnitsManager } from "@/components/admin/units-manager";

export const metadata: Metadata = { title: "Unidades" };

export default function UnitsPage() {
  return <UnitsManager />;
}

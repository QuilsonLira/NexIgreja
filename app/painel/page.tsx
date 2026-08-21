import type { Metadata } from "next";
import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = { title: "Inicio" };

export default function DashboardPage() {
  return <HomeDashboard />;
}

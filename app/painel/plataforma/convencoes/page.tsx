import type { Metadata } from "next";
import { PlatformConventionsManager } from "@/components/platform/platform-units-manager";

export const metadata: Metadata = { title: "Administração do NexIgreja — Convenções" };

export default function PlatformConventionsPage() {
  return <PlatformConventionsManager />;
}

import type { Metadata } from "next";
import { ArchivedUsersManager } from "@/components/platform/platform-archived-users-manager";

export const metadata: Metadata = { title: "Administração do NexIgreja — Usuários arquivados" };

export default function ArchivedUsersPage() {
  return <ArchivedUsersManager />;
}

import type { Metadata } from "next";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata: Metadata = { title: "Usuários" };

export default function UsersPage() {
  return <UsersManager />;
}

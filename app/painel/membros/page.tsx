import type { Metadata } from "next";
import { MembersManager } from "@/components/admin/members-manager";
import "./member-name-uppercase.css";

export const metadata: Metadata = { title: "Pessoas / Membros" };

export default function MembersPage() {
  return <MembersManager />;
}

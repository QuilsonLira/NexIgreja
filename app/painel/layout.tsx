import { ProtectedShell } from "@/components/protected-shell";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}

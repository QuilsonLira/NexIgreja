"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { PasswordDialog } from "@/components/password-dialog";
import type { AdminBootstrap } from "@/lib/admin/types";
import type { AvailableContexts, SafeSessionPayload } from "@/lib/auth/types";
import type { PermissionCode } from "@/lib/admin/permissions";

interface WorkspaceContextValue {
  session: SafeSessionPayload;
  admin: AdminBootstrap;
  hasPermission: (permission: PermissionCode) => boolean;
  openPasswordDialog: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace deve ser usado dentro do painel protegido");
  return value;
}

const navigation = [
  { href: "/painel", label: "Início", icon: LayoutDashboard, permission: null },
  { href: "/painel/unidades", label: "Unidades", icon: Building2, permission: "UNIDADES_VISUALIZAR" },
  { href: "/painel/usuarios", label: "Usuários", icon: Users, permission: "USUARIOS_VISUALIZAR" },
  { href: "/painel/acessos", label: "Histórico de acessos", icon: History, permission: "ACESSOS_VISUALIZAR" }
] as const;

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SafeSessionPayload | null>(null);
  const [contexts, setContexts] = useState<AvailableContexts | null>(null);
  const [admin, setAdmin] = useState<AdminBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [contextFeedback, setContextFeedback] = useState("");
  const [changingContext, setChangingContext] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sessionResponse, contextsResponse, adminResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/session/available-contexts", { cache: "no-store" }),
          fetch("/api/admin/bootstrap", { cache: "no-store" })
        ]);
        if ([sessionResponse, contextsResponse, adminResponse].some((response) => response.status === 401)) {
          router.replace("/login");
          router.refresh();
          return;
        }
        const sessionBody = (await sessionResponse.json()) as { session?: SafeSessionPayload; error?: { message?: string } };
        const contextsBody = (await contextsResponse.json()) as { contexts?: AvailableContexts };
        const adminBody = (await adminResponse.json()) as { admin?: AdminBootstrap; error?: { message?: string } };
        if (!sessionResponse.ok || !contextsResponse.ok || !adminResponse.ok || !sessionBody.session || !contextsBody.contexts || !adminBody.admin) {
          throw new Error(adminBody.error?.message || sessionBody.error?.message || "Não foi possível carregar o painel.");
        }
        if (active) {
          setSession(sessionBody.session);
          setContexts(contextsBody.contexts);
          setAdmin(adminBody.admin);
          setPasswordOpen(sessionBody.session.user.mustChangePassword);
        }
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const permissionSet = useMemo(() => new Set(admin?.permissions ?? []), [admin]);
  const contextOptions = useMemo(() => {
    if (!contexts) return [];
    return contexts.matrices.flatMap((matrix) => [
      { value: `matrix:${matrix.id}`, label: `Matriz · ${matrix.name}` },
      ...contexts.branches
        .filter((branch) => branch.matrixId === matrix.id)
        .map((branch) => ({ value: `branch:${matrix.id}:${branch.id}`, label: `Filial · ${branch.name}` }))
    ]);
  }, [contexts]);
  const selectedContext = session?.activeContext?.branchId
    ? `branch:${session.activeContext.matrixId}:${session.activeContext.branchId}`
    : session?.activeContext?.matrixId
      ? `matrix:${session.activeContext.matrixId}`
      : "";

  async function applyContext(value: string) {
    if (!value || changingContext || session?.user.mustChangePassword) return;
    const [type, matrixValue, branchValue] = value.split(":");
    const matrixId = Number(matrixValue);
    const branchId = type === "branch" ? Number(branchValue) : null;
    if (!matrixId || (type === "branch" && !branchId)) return;
    setChangingContext(true);
    setContextFeedback("");
    try {
      const response = await fetch("/api/session/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrixId, branchId })
      });
      const body = (await response.json()) as { session?: SafeSessionPayload; error?: { message?: string } };
      if (response.status === 401) {
        router.replace("/login");
        router.refresh();
        return;
      }
      if (!response.ok || !body.session) throw new Error(body.error?.message || "Não foi possível trocar a unidade.");
      setSession(body.session);
      setContextFeedback("Unidade atualizada");
      setTimeout(() => setContextFeedback(""), 2500);
    } catch (error) {
      setContextFeedback(error instanceof Error ? error.message : "Não foi possível trocar a unidade.");
    } finally {
      setChangingContext(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <BrandMark />
        <LoaderCircle className="spin" size={28} />
        <p>Preparando seu acesso...</p>
      </main>
    );
  }

  if (!session || !contexts || !admin) {
    return (
      <main className="loading-screen error-screen">
        <ShieldCheck size={34} />
        <h1>Não foi possível abrir o painel</h1>
        <p>{loadError || "Atualize a página e tente novamente."}</p>
        <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </main>
    );
  }

  const canChangeContext = contexts.canChangeMatrix || contexts.canChangeBranch;
  const contextValue: WorkspaceContextValue = {
    session,
    admin,
    hasPermission: (permission) => permissionSet.has(permission),
    openPasswordDialog: () => setPasswordOpen(true)
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="app-shell">
        <aside className={`sidebar${mobileMenu ? " sidebar-open" : ""}`}>
          <div className="sidebar-top">
            <BrandMark inverse />
            <button className="sidebar-close" type="button" onClick={() => setMobileMenu(false)} aria-label="Fechar menu">
              <X size={21} />
            </button>
          </div>
          <div className="sidebar-section-label">Administração</div>
          <nav className="sidebar-nav" aria-label="Navegação principal">
            {navigation
              .filter((item) => !item.permission || permissionSet.has(item.permission))
              .map((item) => {
                const active = item.href === "/painel" ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    className={`nav-item${active ? " nav-item-active" : ""}`}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileMenu(false)}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
          </nav>
          <div className="sidebar-security">
            <ShieldCheck size={19} />
            <div>
              <strong>Sessão protegida</strong>
              <span>Permissões conferidas em cada operação</span>
            </div>
          </div>
        </aside>
        {mobileMenu ? <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} /> : null}

        <div className="app-main">
          <header className="topbar">
            <button className="mobile-menu-button" type="button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu">
              <Menu size={22} />
            </button>
            <div className="topbar-context topbar-context-select">
              <span>Unidade selecionada</span>
              {canChangeContext ? (
                <div className="compact-select-shell">
                  <select
                    aria-label="Selecionar unidade de trabalho"
                    value={selectedContext}
                    onChange={(event) => void applyContext(event.target.value)}
                    disabled={changingContext || session.user.mustChangePassword}
                  >
                    {!selectedContext ? <option value="">Selecione uma unidade</option> : null}
                    {contextOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {changingContext ? <LoaderCircle className="spin" size={15} /> : <ChevronDown size={15} />}
                </div>
              ) : (
                <strong>{session.activeContext?.unitName ?? admin.unitOptions.convention.name}</strong>
              )}
              {contextFeedback ? <small className="context-feedback">{contextFeedback}</small> : null}
            </div>
            <div className="user-menu">
              <span className="user-avatar" aria-hidden="true">{session.user.name.slice(0, 1).toUpperCase()}</span>
              <div className="user-summary">
                <strong>{session.user.name}</strong>
                <span>{session.user.roleName}</span>
              </div>
              <button className="topbar-logout" type="button" onClick={logout} aria-label="Sair do sistema" title="Sair do sistema">
                <LogOut size={19} />
                <span>Sair</span>
              </button>
            </div>
          </header>

          <main className="dashboard-content">{children}</main>
        </div>

        <PasswordDialog
          open={passwordOpen}
          mandatory={session.user.mustChangePassword}
          onClose={() => setPasswordOpen(false)}
        />
      </div>
    </WorkspaceContext.Provider>
  );
}

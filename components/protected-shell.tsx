"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CircleDollarSign,
  CreditCard,
  CalendarClock,
  Briefcase,
  Boxes,
  Archive,
  ChevronDown,
  Crown,
  History,
  HelpCircle,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  UserX,
  ContactRound,
  Database,
  GraduationCap,
  BookCopy,
  X
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { PasswordDialog } from "@/components/password-dialog";
import { ProfilePhotoDialog } from "@/components/profile-photo-dialog";
import { SidebarBrand, UserAvatar } from "@/components/media-display";
import { NotificationCenter } from "@/components/notification-center";
import type { AdminBootstrap } from "@/lib/admin/types";
import type { AvailableContexts, OrganizationOption, SafeSessionPayload } from "@/lib/types";
import { permissionForAdminPath, type PermissionCode } from "@/lib/admin/permissions";

interface WorkspaceContextValue {
  session: SafeSessionPayload;
  admin: AdminBootstrap;
  hasPermission: (permission: PermissionCode) => boolean;
  openPasswordDialog: () => void;
  refreshSession: () => Promise<void>;
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
  { href: "/painel/funcoes", label: "Funções", icon: Briefcase, permission: "FUNCOES_VISUALIZAR" },
  { href: "/painel/membros", label: "Pessoas / Membros", icon: ContactRound, permission: "MEMBROS_VISUALIZAR" },
  { href: "/painel/departamentos", label: "Departamentos e EBD", icon: GraduationCap, permission: "DEPARTAMENTO_VISUALIZAR" },
  { href: "/painel/secretaria", label: "Secretaria Eclesiástica", icon: BookCopy, permission: "SECRETARIA_VISUALIZAR" },
  { href: "/painel/financeiro", label: "Financeiro", icon: CircleDollarSign, permission: "FINANCEIRO_VISUALIZAR" },
  { href: "/painel/dados-exportacao", label: "Dados e Exportação", icon: Database, permission: "DADOS_EXPORTAR" },
  { href: "/painel/acessos", label: "Histórico de acessos", icon: History, permission: "ACESSOS_VISUALIZAR" },
  { href: "/painel/assinatura", label: "Assinatura", icon: CreditCard, permission: "ASSINATURA_VISUALIZAR" }
] as const;

const platformNavigation = [
  { href: "/painel/plataforma/clientes", label: "Clientes SaaS", icon: Boxes },
  { href: "/painel/plataforma/comercial", label: "Comercial", icon: CircleDollarSign },
  { href: "/painel/plataforma/dados", label: "Dados e Backups", icon: Database },
  { href: "/painel/plataforma/convencoes", label: "Convenções", icon: Crown },
  { href: "/painel/plataforma/arquivadas", label: "Unidades arquivadas", icon: Archive },
  { href: "/painel/plataforma/usuarios-arquivados", label: "Usuários arquivados", icon: UserX },
  { href: "/painel/ajuda", label: "Central de Ajuda", icon: HelpCircle },
] as const;

const platformShellAdmin: AdminBootstrap = {
  isPlatformOwner: true,
  permissions: [],
  permissionDefinitions: [],
  unitOptions: { convention: { id: -1, name: "Plataforma NexIgreja", status: "ATIVO" }, matrices: [], branches: [] },
  allowedUserScopes: [],
  creatableUnitTypes: [],
  functionOptions: [],
};

const platformShellContexts: AvailableContexts = {
  tenants: [], conventions: [], matrices: [], branches: [], fixedMatrixId: null,
  canChangeConvention: false, canChangeMatrix: false, canChangeBranch: false,
};

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<SafeSessionPayload | null>(null);
  const [contexts, setContexts] = useState<AvailableContexts | null>(null);
  const [admin, setAdmin] = useState<AdminBootstrap | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [contextFeedback, setContextFeedback] = useState("");
  const [changingContext, setChangingContext] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoOptional, setPhotoOptional] = useState(false);
  const [helpUnread, setHelpUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const requestOptions = { cache: "no-store" as const, credentials: "same-origin" as const, signal: controller.signal };
        const sessionResponse = await fetch("/api/auth/me", requestOptions);
        if (sessionResponse.status === 401) {
          window.location.replace("/login");
          return;
        }
        const sessionBody = (await sessionResponse.json()) as { session?: SafeSessionPayload; error?: { message?: string } };
        if (!sessionResponse.ok || !sessionBody.session) {
          throw new Error(sessionBody.error?.message || "Não foi possível validar sua sessão.");
        }

        if (!sessionBody.session.user.isPlatformOwner && sessionBody.session.license && !sessionBody.session.license.canAccess) {
          if (active) {
            setSession(sessionBody.session);
            setContexts(platformShellContexts);
            setAdmin({ ...platformShellAdmin, isPlatformOwner: false });
            setOrganizations([]);
          }
          return;
        }

        if (sessionBody.session.user.isPlatformOwner && !sessionBody.session.user.platformTenantContextActive) {
          if (!pathname.startsWith("/painel/plataforma") && !pathname.startsWith("/painel/ajuda") && !pathname.startsWith("/painel/notificacoes")) {
            window.location.replace("/painel/plataforma/clientes");
            return;
          }
          if (active) {
            setSession(sessionBody.session);
            setContexts(platformShellContexts);
            setAdmin(platformShellAdmin);
            setOrganizations([]);
            setPasswordOpen(sessionBody.session.user.mustChangePassword);
          }
          return;
        }

        const [contextsResponse, adminResponse, organizationsResponse] = await Promise.all([
          fetch("/api/session/available-contexts", requestOptions),
          fetch("/api/admin/bootstrap", requestOptions),
          fetch("/api/session/organizations", requestOptions),
        ]);
        if (contextsResponse.status === 401 || adminResponse.status === 401 || organizationsResponse.status === 401) {
          window.location.replace("/login");
          return;
        }
        const contextsBody = (await contextsResponse.json()) as { contexts?: AvailableContexts };
        const adminBody = (await adminResponse.json()) as { admin?: AdminBootstrap; error?: { message?: string } };
        const organizationsBody = (await organizationsResponse.json()) as { organizations?: OrganizationOption[] };
        if (!contextsResponse.ok || !adminResponse.ok || !organizationsResponse.ok || !contextsBody.contexts || !adminBody.admin) {
          throw new Error(adminBody.error?.message || sessionBody.error?.message || "Não foi possível carregar o painel.");
        }
        if (active) {
          setSession(sessionBody.session);
          setContexts(contextsBody.contexts);
          setAdmin(adminBody.admin);
          setOrganizations((organizationsBody.organizations ?? []).filter((item) => item.membershipStatus === "ATIVO"));
          setPasswordOpen(sessionBody.session.user.mustChangePassword);
          const photoDismissed = window.sessionStorage.getItem("nexigreja-photo-prompt-dismissed") === "1";
          if (!sessionBody.session.user.mustChangePassword && !sessionBody.session.user.profilePhotoUrl && !photoDismissed) {
            setPhotoOptional(true);
            setPhotoOpen(true);
          }
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof DOMException && error.name === "AbortError"
            ? "O carregamento demorou mais do que o esperado. Tente novamente."
            : error instanceof Error ? error.message : "Não foi possível carregar o painel.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void fetch("/api/help/articles", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { result?: { unreadNews?: number } } | null) => { if (active) setHelpUnread(body?.result?.unreadNews ?? 0); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session, pathname]);

  const permissionSet = useMemo(() => new Set(admin?.permissions ?? []), [admin]);
  const contextOptions = useMemo(() => {
    if (!contexts) return [];
    return [
      ...contexts.conventions.map((convention) => ({ value: `convention:${convention.id}`, label: convention.tenantName ? `${convention.tenantName} · Convenção · ${convention.name}` : `Convenção · ${convention.name}` })),
      ...contexts.matrices.flatMap((matrix) => [
      { value: `matrix:${matrix.id}`, label: `Matriz · ${matrix.name}` },
      ...contexts.branches
        .filter((branch) => branch.matrixId === matrix.id)
        .map((branch) => ({ value: `branch:${matrix.id}:${branch.id}`, label: `Filial · ${branch.name}` }))
      ]),
    ];
  }, [contexts]);
  const selectedContext = session?.activeContext?.unitType === "CONVENCAO"
    ? `convention:${session.activeContext.unitId}`
    : session?.activeContext?.branchId
    ? `branch:${session.activeContext.matrixId}:${session.activeContext.branchId}`
    : session?.activeContext?.matrixId
      ? `matrix:${session.activeContext.matrixId}`
      : session?.user.isPlatformOwner
        ? session.activeConvention ? `convention:${session.activeConvention.id}` : ""
        : "";

  async function applyContext(value: string) {
    if (!value || changingContext || session?.user.mustChangePassword) return;
    const [type, matrixValue, branchValue] = value.split(":");
    const conventionId = type === "convention" ? Number(matrixValue) : null;
    const matrixId = type === "convention" ? null : Number(matrixValue);
    const branchId = type === "branch" ? Number(branchValue) : null;
    if ((!conventionId && !matrixId) || (type === "branch" && !branchId)) return;
    setChangingContext(true);
    setContextFeedback("");
    try {
      const response = await fetch("/api/session/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conventionId, matrixId, branchId })
      });
      const body = (await response.json()) as { session?: SafeSessionPayload; error?: { message?: string } };
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok || !body.session) throw new Error(body.error?.message || "Não foi possível trocar a unidade.");
      setSession(body.session);
      const [contextsResponse, adminResponse] = await Promise.all([
        fetch("/api/session/available-contexts", { cache: "no-store" }),
        fetch("/api/admin/bootstrap", { cache: "no-store" }),
      ]);
      const contextsBody = (await contextsResponse.json()) as { contexts?: AvailableContexts };
      const adminBody = (await adminResponse.json()) as { admin?: AdminBootstrap };
      if (contextsBody.contexts) setContexts(contextsBody.contexts);
      if (adminBody.admin) setAdmin(adminBody.admin);
      setContextFeedback("Unidade atualizada");
      setTimeout(() => setContextFeedback(""), 2500);
    } catch (error) {
      setContextFeedback(error instanceof Error ? error.message : "Não foi possível trocar a unidade.");
    } finally {
      setChangingContext(false);
    }
  }

  async function applyOrganization(membershipId: number) {
    if (!membershipId || changingContext || session?.user.mustChangePassword) return;
    setChangingContext(true);
    setContextFeedback("");
    try {
      const response = await fetch("/api/session/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ membershipId }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(body.error?.message || "Não foi possível trocar a organização.");
      window.location.reload();
    } catch (error) {
      setContextFeedback(error instanceof Error ? error.message : "Não foi possível trocar a organização.");
      setChangingContext(false);
    }
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store"
      });
    } finally {
      // Force a full navigation after the server revokes the session and
      // clears the HttpOnly cookie. This avoids leaving the cached panel on
      // screen while a client-side navigation is still being resolved.
      window.location.replace(session?.user.isPlatformOwner ? "/platform/login" : "/login");
    }
  }

  async function leavePlatformTenant() {
    if (changingContext) return;
    setChangingContext(true);
    try {
      const response = await fetch("/api/platform/context", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("Não foi possível voltar à Administração do NexIgreja.");
      window.location.replace("/painel/plataforma/clientes");
    } catch (error) {
      setContextFeedback(error instanceof Error ? error.message : "Não foi possível trocar o contexto.");
      setChangingContext(false);
    }
  }

  async function saveOwnPhoto(file: File): Promise<boolean> {
    const response = await fetch("/api/auth/profile-photo", {
      method: "PUT",
      headers: { "Content-Type": file.type },
      credentials: "same-origin",
      body: file,
    });
    const body = (await response.json()) as { profilePhotoUrl?: string | null; error?: { message?: string } };
    if (!response.ok || !body.profilePhotoUrl) throw new Error(body.error?.message || "Não foi possível atualizar a foto.");
    setSession((current) => current ? { ...current, user: { ...current.user, profilePhotoUrl: body.profilePhotoUrl! } } : current);
    setPhotoOptional(false);
    return true;
  }

  async function removeOwnPhoto(): Promise<boolean> {
    const response = await fetch("/api/auth/profile-photo", { method: "DELETE", credentials: "same-origin" });
    const body = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message || "Não foi possível remover a foto.");
    setSession((current) => current ? { ...current, user: { ...current.user, profilePhotoUrl: null } } : current);
    window.sessionStorage.setItem("nexigreja-photo-prompt-dismissed", "1");
    setPhotoOptional(false);
    return true;
  }

  function closePhotoDialog() {
    if (photoOptional) window.sessionStorage.setItem("nexigreja-photo-prompt-dismissed", "1");
    setPhotoOpen(false);
    setPhotoOptional(false);
  }

  async function refreshSession() {
    if (session?.user.isPlatformOwner && !session.user.platformTenantContextActive) {
      const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
      const body = (await response.json()) as { session?: SafeSessionPayload };
      if (response.ok && body.session) setSession(body.session);
      return;
    }
    const [sessionResponse, contextsResponse, adminResponse, organizationsResponse] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/session/available-contexts", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/admin/bootstrap", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/session/organizations", { cache: "no-store", credentials: "same-origin" }),
    ]);
    const sessionBody = (await sessionResponse.json()) as { session?: SafeSessionPayload };
    const contextsBody = (await contextsResponse.json()) as { contexts?: AvailableContexts };
    const adminBody = (await adminResponse.json()) as { admin?: AdminBootstrap };
    const organizationsBody = (await organizationsResponse.json()) as { organizations?: OrganizationOption[] };
    if (sessionResponse.ok && sessionBody.session) setSession(sessionBody.session);
    if (contextsResponse.ok && contextsBody.contexts) setContexts(contextsBody.contexts);
    if (adminResponse.ok && adminBody.admin) setAdmin(adminBody.admin);
    if (organizationsResponse.ok) setOrganizations((organizationsBody.organizations ?? []).filter((item) => item.membershipStatus === "ATIVO"));
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

  if (session && !session.user.isPlatformOwner && session.license && !session.license.canAccess) {
    const payment=session.license.payment;
    return <main className="license-block-page"><section className="license-block-card"><BrandMark/><span className="license-block-icon"><ShieldCheck size={34}/></span><p className="eyebrow">Licença NexIgreja</p><h1>{session.license.title}</h1><p>{session.license.message}</p><div className="license-payment-box"><strong>Como regularizar</strong>{payment.pixKey?<p>Chave Pix: <b>{payment.pixKey}</b></p>:null}{payment.payeeName?<p>Favorecido: {payment.payeeName}</p>:null}{payment.instructions?<p>{payment.instructions}</p>:null}{payment.supportContact?<p>Contato: {payment.supportContact}</p>:null}</div><button className="primary-button compact-button" onClick={()=>void logout()} disabled={loggingOut}>{loggingOut?<LoaderCircle className="spin" size={18}/>:<LogOut size={18}/>}Sair</button></section>{loggingOut?<div className="logout-overlay"><div className="logout-loading"><LoaderCircle className="spin" size={36}/><strong>Saindo do sistema...</strong></div></div>:null}</main>;
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

  const canChangeContext = contexts.canChangeConvention || contexts.canChangeMatrix || contexts.canChangeBranch;
  const requiredPermission = permissionForAdminPath(pathname);
  const subscriptionAuthorized=requiredPermission==="ASSINATURA_VISUALIZAR"&&Boolean(session.license?.canViewDetails);
  const routeDenied = Boolean((requiredPermission && !subscriptionAuthorized && !permissionSet.has(requiredPermission)) || (pathname.startsWith("/painel/plataforma") && !session.user.isPlatformOwner));
  const contextValue: WorkspaceContextValue = {
    session,
    admin,
    hasPermission: (permission) => permissionSet.has(permission),
    openPasswordDialog: () => setPasswordOpen(true),
    refreshSession,
  };

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="app-shell" aria-busy={loggingOut} inert={loggingOut ? true : undefined}>
        <aside className={`sidebar${mobileMenu ? " sidebar-open" : ""}`}>
          <div className="sidebar-top">
            <SidebarBrand logoUrl={session.unitLogoUrl} />
            <button className="sidebar-close" type="button" onClick={() => setMobileMenu(false)} aria-label="Fechar menu">
              <X size={21} />
            </button>
          </div>
          <div className="sidebar-scroll-region">
          {!session.user.isPlatformOwner || session.user.platformTenantContextActive ? <><div className="sidebar-section-label">Administração</div>
          <nav className="sidebar-nav" aria-label="Navegação principal">
            {navigation
              .filter((item) => !item.permission || permissionSet.has(item.permission) || (item.permission === "ASSINATURA_VISUALIZAR" && session.license?.canViewDetails))
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
          </nav></> : null}
          {session.user.isPlatformOwner ? (
            <>
              <div className="sidebar-section-label platform-section-label">Administração do NexIgreja</div>
              <nav className="sidebar-nav" aria-label="Administração da plataforma">
                {platformNavigation.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return <Link key={item.href} className={`nav-item platform-nav-item${active ? " nav-item-active" : ""}`} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMobileMenu(false)}><Icon size={20} />{item.label}</Link>;
                })}
              </nav>
            </>
          ) : null}
          </div>
          <div className="sidebar-security">
            <ShieldCheck size={19} />
            <div>
              <strong>Sessão protegida</strong>
              <span>Permissões conferidas em cada operação</span>
            </div>
          </div>
          <Link className={`nav-item sidebar-help-link${pathname.startsWith("/painel/ajuda") ? " nav-item-active" : ""}`} href="/painel/ajuda" onClick={() => setMobileMenu(false)}><HelpCircle size={20} />Ajuda e Suporte{helpUnread ? <span className="help-count">{helpUnread}</span> : null}</Link>
        </aside>
        {mobileMenu ? <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} /> : null}

        <div className="app-main">
          <header className="topbar">
            <button className="mobile-menu-button" type="button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu">
              <Menu size={22} />
            </button>
            {organizations.length > 1 ? (
              <div className="topbar-organization-select">
                <span>Organização</span>
                <div className="compact-select-shell">
                  <select
                    aria-label="Trocar organização"
                    value={session.user.membershipId ?? ""}
                    onChange={(event) => void applyOrganization(Number(event.target.value))}
                    disabled={changingContext || session.user.mustChangePassword}
                  >
                    {organizations.map((organization) => (
                      <option key={organization.membershipId} value={organization.membershipId}>{organization.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </div>
              </div>
            ) : null}
            <div className="topbar-context topbar-context-select">
              <span>{session.user.isPlatformOwner ? session.user.platformTenantContextActive ? `Administrando: ${session.activeTenant?.name ?? "cliente"}` : "Administração do NexIgreja" : "Unidade selecionada"}</span>
              {session.user.isPlatformOwner && !session.user.platformTenantContextActive ? <strong>Plataforma</strong> : canChangeContext ? (
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
            <NotificationCenter contextKey={`${session.user.id}:${session.activeTenant?.id ?? "platform"}`} />
            <Link className="topbar-help" href="/painel/ajuda" aria-label={`Abrir Central de Ajuda${helpUnread ? `, ${helpUnread} novidades` : ""}`} title="Central de Ajuda"><HelpCircle size={20}/><span>Ajuda</span>{helpUnread ? <b>{helpUnread}</b> : null}</Link>
            <div className="user-menu">
              <button className="avatar-button" type="button" onClick={() => { setPhotoOptional(false); setPhotoOpen(true); }} aria-label="Alterar foto de perfil" title="Foto de perfil">
                <UserAvatar photoUrl={session.user.profilePhotoUrl} name={session.user.name} />
              </button>
              <div className="user-summary">
                <strong>{session.user.name}</strong>
                <span>{session.user.isPlatformOwner ? "Proprietário da plataforma" : session.user.roleName}</span>
              </div>
              <button className="topbar-logout" type="button" onClick={logout} aria-label="Sair do sistema" title="Sair do sistema" disabled={loggingOut}>
                {loggingOut ? <LoaderCircle className="spin" size={19} aria-hidden="true" /> : <LogOut size={19} />}
                <span>{loggingOut ? "Saindo..." : "Sair"}</span>
              </button>
            </div>
          </header>

          <main className="dashboard-content">
            {session.user.isPlatformOwner && session.user.platformTenantContextActive ? <section className="platform-context-banner"><div><Crown size={20} /><span>Administrando: <strong>{session.activeTenant?.name ?? "cliente selecionado"}</strong></span></div><button className="secondary-button compact-button" type="button" onClick={() => void leavePlatformTenant()} disabled={changingContext}>Voltar à Administração do NexIgreja</button></section> : null}
            {!session.user.isPlatformOwner && session.license?.canViewDetails && (session.license.status !== "ATIVA" || (session.license.daysRemaining !== null && session.license.daysRemaining <= session.license.payment.warningDays)) ? <Link href="/painel/assinatura" className={`license-notice license-${session.license.status.toLowerCase()}`}><CalendarClock size={20}/><div><strong>{session.license.title}</strong><span>{session.license.message}</span></div><span>Ver assinatura</span></Link> : null}
            {routeDenied ? (
              <section className="content-card access-denied-card" role="alert">
                <ShieldCheck size={38} />
                <p className="eyebrow">Acesso negado</p>
                <h1>Você não possui permissão para abrir esta área.</h1>
                <p>Solicite a liberação ao administrador responsável ou volte ao painel inicial.</p>
                <Link className="primary-button compact-button" href="/painel">Voltar ao início</Link>
              </section>
            ) : children}
          </main>
        </div>

        <PasswordDialog
          open={passwordOpen}
          mandatory={session.user.mustChangePassword}
          onClose={() => setPasswordOpen(false)}
          onSuccess={(nextSession) => {
            setSession(nextSession);
            setPasswordOpen(false);
            if (!nextSession.user.profilePhotoUrl && window.sessionStorage.getItem("nexigreja-photo-prompt-dismissed") !== "1") {
              setPhotoOptional(true);
              setPhotoOpen(true);
            }
          }}
        />
      </div>
      <ProfilePhotoDialog
        open={photoOpen}
        name={session.user.name}
        currentPhotoUrl={session.user.profilePhotoUrl}
        optional={photoOptional}
        onClose={closePhotoDialog}
        onUse={saveOwnPhoto}
        onRemove={session.user.profilePhotoUrl ? removeOwnPhoto : undefined}
      />
      {loggingOut ? (
        <div className="logout-overlay" role="status" aria-live="polite" aria-label="Saindo do sistema">
          <div className="logout-loading">
            <LoaderCircle className="spin" size={36} aria-hidden="true" />
            <strong>Saindo do sistema...</strong>
          </div>
        </div>
      ) : null}
    </WorkspaceContext.Provider>
  );
}

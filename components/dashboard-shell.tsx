"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarClock, ChevronDown, KeyRound, LayoutDashboard, LoaderCircle, LogOut, Menu, Network, ShieldCheck, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { PasswordDialog } from "@/components/password-dialog";
import type { AvailableContexts, SafeSessionPayload } from "@/lib/types";

const scopeLabels = { CONVENCAO: "Escopo: Convenção", MATRIZ: "Escopo: Matriz", FILIAL: "Escopo: Filial" } as const;

function formatLastAccess(session: SafeSessionPayload): string {
  const access = session.lastPreviousAccess;
  if (!access) return "Este é o primeiro acesso registrado.";
  const formatted = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(access.dateTime));
  const type = { CPF: "CPF", USUARIO: "nome de usuário", EMAIL: "e-mail" }[access.identifierType];
  return `${formatted}, utilizando ${type}${access.originSummary ? ` — ${access.originSummary}` : ""}.`;
}

export function DashboardShell() {
  const [session, setSession] = useState<SafeSessionPayload | null>(null);
  const [contexts, setContexts] = useState<AvailableContexts | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingContext, setChangingContext] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [sessionResponse, contextsResponse] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/session/available-contexts", { cache: "no-store" }),
        ]);
        if (sessionResponse.status === 401 || contextsResponse.status === 401) { window.location.replace("/login"); return; }
        const sessionBody = (await sessionResponse.json()) as { session?: SafeSessionPayload };
        const contextsBody = (await contextsResponse.json()) as { contexts?: AvailableContexts };
        if (!sessionResponse.ok || !contextsResponse.ok || !sessionBody.session || !contextsBody.contexts) throw new Error("Falha ao carregar o contexto");
        if (active) { setSession(sessionBody.session); setContexts(contextsBody.contexts); setPasswordOpen(sessionBody.session.user.mustChangePassword); }
      } catch { if (active) setFeedback("Não foi possível carregar sua sessão. Atualize a página."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const selectedMatrixId = session?.activeContext?.matrixId ?? null;
  const selectedBranchId = session?.activeContext?.branchId ?? null;
  const visibleBranches = useMemo(() => contexts?.branches.filter((branch) => branch.matrixId === selectedMatrixId) ?? [], [contexts, selectedMatrixId]);

  async function applyContext(matrixId: number, branchId: number | null) {
    if (changingContext || session?.user.mustChangePassword) return;
    setChangingContext(true); setFeedback("");
    try {
      const response = await fetch("/api/session/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matrixId, branchId }) });
      const body = (await response.json()) as { session?: SafeSessionPayload; error?: { message?: string } };
      if (response.status === 401) { window.location.replace("/login"); return; }
      if (!response.ok || !body.session) { setFeedback(body.error?.message || "Não foi possível trocar a unidade."); return; }
      setSession(body.session); setFeedback("Unidade de trabalho atualizada.");
    } catch { setFeedback("Não foi possível conectar ao sistema."); }
    finally { setChangingContext(false); }
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { window.location.replace("/login"); }
  }

  if (loading) return <main className="loading-screen" aria-live="polite"><BrandMark /><LoaderCircle className="spin" size={28} /><p>Preparando seu acesso...</p></main>;
  if (!session || !contexts) return <main className="loading-screen error-screen"><ShieldCheck size={34} /><h1>Não foi possível abrir o painel</h1><p>{feedback}</p><button className="secondary-button" type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>;

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileMenu ? " sidebar-open" : ""}`}>
        <div className="sidebar-top"><BrandMark inverse /><button className="sidebar-close" type="button" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={21} /></button></div>
        <nav className="sidebar-nav" aria-label="Navegação principal"><a className="nav-item nav-item-active" href="/painel" aria-current="page"><LayoutDashboard size={20} />Início</a></nav>
        <div className="sidebar-security"><ShieldCheck size={19} /><div><strong>Sessão protegida</strong><span>Dados limitados ao seu acesso</span></div></div>
      </aside>
      {mobileMenu ? <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} /> : null}

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu-button" type="button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={22} /></button>
          <div className="topbar-context"><span>Unidade selecionada</span><strong>{session.activeContext?.unitName ?? "Selecione uma unidade"}</strong></div>
          <div className="user-menu"><span className="user-avatar" aria-hidden="true">{session.user.name.slice(0, 1).toUpperCase()}</span><div className="user-summary"><strong>{session.user.name}</strong><span>{session.user.roleName}</span></div><ChevronDown size={17} aria-hidden="true" /></div>
        </header>

        <main className="dashboard-content">
          <section className="welcome-row"><div><p className="eyebrow">Painel inicial</p><h1>Olá, {session.user.name.split(" ")[0]}.</h1><p>Seu acesso está pronto e respeita o alcance definido para sua conta.</p></div><span className="scope-badge"><Network size={17} />{scopeLabels[session.user.organizationalScope]}</span></section>

          {session.user.mustChangePassword ? <button className="security-banner" type="button" onClick={() => setPasswordOpen(true)}><KeyRound size={22} /><span><strong>Troque sua senha temporária</strong>Essa etapa é obrigatória antes de continuar.</span><span className="banner-action">Trocar agora</span></button> : null}

          <section className="dashboard-grid">
            <article className="content-card context-card">
              <div className="card-heading"><span className="card-icon"><Building2 size={21} /></span><div><p className="eyebrow">Unidade de trabalho</p><h2>Escolha onde deseja trabalhar</h2></div></div>
              {session.user.organizationalScope === "FILIAL" ? <div className="fixed-context"><span>Unidade vinculada</span><strong>{session.activeContext?.unitName}</strong><small>A troca de unidade não está disponível para este acesso.</small></div> : (
                <div className="context-fields">
                  <div className="field-group"><label htmlFor="matrix-select">Matriz</label><select id="matrix-select" value={selectedMatrixId ?? ""} disabled={!contexts.canChangeMatrix || changingContext || session.user.mustChangePassword} onChange={(event) => { const matrixId = Number(event.target.value); if (matrixId) void applyContext(matrixId, null); }}><option value="">Selecione uma matriz</option>{contexts.matrices.map((matrix) => <option key={matrix.id} value={matrix.id}>{matrix.name}</option>)}</select></div>
                  <div className="field-group"><label htmlFor="branch-select">Unidade</label><select id="branch-select" value={selectedBranchId ?? ""} disabled={!selectedMatrixId || changingContext || session.user.mustChangePassword} onChange={(event) => { if (!selectedMatrixId) return; void applyContext(selectedMatrixId, event.target.value ? Number(event.target.value) : null); }}><option value="">Trabalhar na própria matriz</option>{visibleBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
                </div>
              )}
              <div className={`inline-feedback${feedback ? " inline-feedback-visible" : ""}`} aria-live="polite">{changingContext ? <LoaderCircle className="spin" size={16} /> : null}{changingContext ? "Atualizando unidade..." : feedback}</div>
            </article>

            <article className="content-card access-card">
              <div className="card-heading"><span className="card-icon card-icon-blue"><CalendarClock size={21} /></span><div><p className="eyebrow">Segurança da conta</p><h2>Último acesso anterior</h2></div></div>
              <p className="last-access-text">{formatLastAccess(session)}</p>
              <div className="access-actions"><button className="text-button" type="button" onClick={() => setPasswordOpen(true)}><KeyRound size={18} />Trocar minha senha</button><button className="text-button text-button-danger" type="button" onClick={logout}><LogOut size={18} />Sair do sistema</button></div>
            </article>
          </section>

          <section className="content-card foundation-card"><div className="foundation-icon"><ShieldCheck size={25} /></div><div><p className="eyebrow">Primeira etapa</p><h2>Base de acesso configurada</h2><p>Login, sessão, auditoria e isolamento das unidades estão funcionando neste ambiente de teste.</p></div><div className="foundation-status"><span />Proteção ativa</div></section>
        </main>
      </div>
      <PasswordDialog
        open={passwordOpen}
        mandatory={session.user.mustChangePassword}
        onClose={() => setPasswordOpen(false)}
        onSuccess={(nextSession) => {
          setSession(nextSession);
          setPasswordOpen(false);
        }}
      />
    </div>
  );
}

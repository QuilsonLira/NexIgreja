"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  History,
  KeyRound,
  Network,
  ShieldCheck,
  Users
} from "lucide-react";
import { useWorkspace } from "@/components/protected-shell";

const scopeLabels = {
  CONVENCAO: "Acesso da Convenção",
  MATRIZ: "Acesso da Matriz",
  FILIAL: "Acesso da Filial"
} as const;

function formatLastAccess(dateTime: string, identifierType: "CPF" | "USUARIO" | "EMAIL") {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateTime));
  const method = { CPF: "CPF", USUARIO: "nome de usuário", EMAIL: "e-mail" }[identifierType];
  return `${formatted}, usando ${method}.`;
}

export function HomeDashboard() {
  const { session, hasPermission, openPasswordDialog } = useWorkspace();
  const firstName = session.user.name.split(" ")[0];
  const actions = [
    hasPermission("UNIDADES_VISUALIZAR")
      ? { href: "/painel/unidades", title: "Unidades", text: "Convenção, matrizes e filiais", icon: Building2 }
      : null,
    hasPermission("USUARIOS_VISUALIZAR")
      ? { href: "/painel/usuarios", title: "Usuários", text: "Acessos, vínculos e permissões", icon: Users }
      : null,
    hasPermission("ACESSOS_VISUALIZAR")
      ? { href: "/painel/acessos", title: "Histórico", text: "Entradas e eventos de segurança", icon: History }
      : null
  ].filter(Boolean) as Array<{ href: string; title: string; text: string; icon: typeof Building2 }>;

  return (
    <>
      <section className="welcome-row">
        <div>
          <p className="eyebrow">Painel administrativo</p>
          <h1>Olá, {firstName}.</h1>
          <p>Administre apenas os dados e as ações liberados para seu acesso.</p>
        </div>
        <span className="scope-badge">
          <Network size={17} />
          {scopeLabels[session.user.organizationalScope]}
        </span>
      </section>

      {session.user.mustChangePassword ? (
        <button className="security-banner" type="button" onClick={openPasswordDialog}>
          <KeyRound size={22} />
          <span>
            <strong>Troque sua senha temporária</strong>
            Essa etapa é obrigatória antes de usar a administração.
          </span>
          <span className="banner-action">Trocar agora</span>
        </button>
      ) : null}

      <section className="home-overview-grid">
        <article className="content-card current-unit-card">
          <div className="card-heading">
            <span className="card-icon"><Building2 size={21} /></span>
            <div>
              <p className="eyebrow">Contexto atual</p>
              <h2>{session.activeContext?.unitName ?? "Nenhuma unidade selecionada"}</h2>
            </div>
          </div>
          <p>
            Todas as operações são novamente comparadas com o vínculo da sua conta antes de acessar o banco.
          </p>
          <div className="security-proof"><ShieldCheck size={17} /> Escopo validado no servidor</div>
        </article>

        <article className="content-card last-access-card">
          <div className="card-heading">
            <span className="card-icon card-icon-blue"><CalendarClock size={21} /></span>
            <div>
              <p className="eyebrow">Segurança da conta</p>
              <h2>Último acesso anterior</h2>
            </div>
          </div>
          <p className="last-access-text">
            {session.lastPreviousAccess
              ? formatLastAccess(session.lastPreviousAccess.dateTime, session.lastPreviousAccess.identifierType)
              : "Este é o primeiro acesso registrado."}
          </p>
          <button className="text-button" type="button" onClick={openPasswordDialog}>
            <KeyRound size={18} /> Trocar minha senha
          </button>
        </article>
      </section>

      <section className="quick-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Acesso rápido</p>
            <h2>Administração</h2>
          </div>
        </div>
        {actions.length ? (
          <div className="quick-action-grid">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link className="quick-action-card" href={action.href} key={action.href}>
                  <span className="quick-action-icon"><Icon size={22} /></span>
                  <span>
                    <strong>{action.title}</strong>
                    <small>{action.text}</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="content-card no-permissions-card">
            <ShieldCheck size={24} />
            <div>
              <strong>Nenhuma função administrativa liberada</strong>
              <p>Solicite ao administrador da sua unidade as permissões necessárias.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

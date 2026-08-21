"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeftRight, ArrowRight, Building2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import type { InstitutionContext } from "@/lib/types";

interface ApiBody {
  error?: { message?: string };
  institution?: InstitutionContext | null;
}

export function LoginForm({ initialMessage = "", platformMode = false }: { initialMessage?: string; platformMode?: boolean }) {
  const [institution, setInstitution] = useState<InstitutionContext | null>(null);
  const [checkingInstitution, setCheckingInstitution] = useState(!platformMode);
  const [code, setCode] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialMessage);

  useEffect(() => {
    if (platformMode) return;
    let active = true;
    void fetch("/api/public/institution", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json() as Promise<ApiBody>)
      .then((body) => { if (active) setInstitution(body.institution ?? null); })
      .catch(() => undefined)
      .finally(() => { if (active) setCheckingInstitution(false); });
    return () => { active = false; };
  }, [platformMode]);

  async function identify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!/^\d{7}$/.test(code)) { setError("Informe exatamente os 7 números do código da instituição."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/public/institution", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ code }) });
      const body = await response.json() as ApiBody;
      if (!response.ok || !body.institution) throw new Error(body.error?.message || "Não foi possível identificar a instituição.");
      setInstitution(body.institution); setCode("");
      window.dispatchEvent(new Event("nexigreja:institution-changed"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível identificar a instituição.");
    } finally { setLoading(false); }
  }

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!identifier.trim() || !password) { setError("Preencha seu acesso e sua senha."); return; }
    setLoading(true); setError("");
    let opening = false;
    try {
      const response = await fetch(platformMode ? "/api/platform/auth/login" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ identifier, password }) });
      const body = await response.json() as ApiBody;
      if (!response.ok) throw new Error(body.error?.message || "Não foi possível entrar.");
      opening = true;
      window.location.replace(platformMode ? "/painel/plataforma/clientes" : "/painel");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível conectar ao sistema.");
    } finally { if (!opening) setLoading(false); }
  }

  async function changeInstitution() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      await fetch("/api/public/institution", { method: "DELETE", credentials: "same-origin" });
      setInstitution(null); setIdentifier(""); setPassword("");
      window.dispatchEvent(new Event("nexigreja:institution-changed"));
    } finally { setLoading(false); }
  }

  if (checkingInstitution) return <div className="login-form institution-loading" role="status"><LoaderCircle className="spin" size={24} /><span>Preparando o acesso...</span></div>;

  if (!platformMode && !institution) {
    return <form className="login-form" onSubmit={identify} noValidate>
      <div className="institution-intro"><Building2 size={22} /><div><strong>Acesse sua instituição</strong><span>Digite o código de 7 números fornecido pelo NexIgreja.</span></div></div>
      <div className="field-group"><label htmlFor="institution-code">Código da instituição</label><div className="input-shell"><Building2 size={19} /><input id="institution-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 7))} inputMode="numeric" pattern="[0-9]{7}" maxLength={7} autoComplete="off" autoFocus disabled={loading} placeholder="0000000" /></div></div>
      <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error ? <AlertCircle size={17} /> : null}<span>{error}</span></div>
      <button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={20} />}{loading ? "Verificando..." : "Continuar"}</button>
      <Link className="platform-login-link" href="/platform/login"><ShieldCheck size={17} /> Administração da plataforma</Link>
    </form>;
  }

  return <form className="login-form" onSubmit={authenticate} noValidate>
    {platformMode ? <div className="institution-intro"><ShieldCheck size={22} /><div><strong>Acesso administrativo — NexIgreja</strong><span>Exclusivo para o proprietário da plataforma.</span></div></div> : <div className="institution-context"><span>Instituição identificada</span><strong>{institution?.name}</strong></div>}
    <div className="field-group"><label htmlFor="identifier">CPF, usuário ou e-mail</label><div className="input-shell"><UserRound size={19} /><input id="identifier" type="text" autoComplete="username" autoFocus maxLength={254} value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={loading} /></div></div>
    <div className="field-group"><label htmlFor="password">Senha</label><div className="input-shell"><LockKeyhole size={19} /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} /><button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} disabled={loading}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
    <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error ? <AlertCircle size={17} /> : null}<span>{error}</span></div>
    <button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={20} />}{loading ? "Entrando..." : "Entrar"}</button>
    {platformMode ? <Link className="platform-login-link" href="/login"><ArrowLeftRight size={17} /> Acesso de uma instituição</Link> : <button className="platform-login-link" type="button" onClick={() => void changeInstitution()} disabled={loading}><ArrowLeftRight size={17} /> Trocar instituição</button>}
  </form>;
}

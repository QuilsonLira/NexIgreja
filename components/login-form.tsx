"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";

interface ApiErrorBody {
  error?: { message?: string };
}

export function LoginForm({ initialMessage = "" }: { initialMessage?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialMessage);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");

    if (!identifier.trim() || !password) {
      setError("Preencha seu acesso e sua senha.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        setError(body.error?.message || "Não foi possível entrar.");
        return;
      }
      router.replace("/painel");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao sistema. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <div className="field-group">
        <label htmlFor="identifier">CPF, usuário ou e-mail</label>
        <div className="input-shell">
          <UserRound size={19} aria-hidden="true" />
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            inputMode="text"
            autoFocus
            maxLength={254}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            disabled={loading}
            aria-describedby={error ? "login-feedback" : undefined}
          />
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="password">Senha</label>
        <div className="input-shell">
          <LockKeyhole size={19} aria-hidden="true" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            aria-describedby={error ? "login-feedback" : undefined}
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            disabled={loading}
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>

      <div
        id="login-feedback"
        className={`form-feedback${error ? " form-feedback-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {error ? <AlertCircle size={17} aria-hidden="true" /> : null}
        <span>{error}</span>
      </div>

      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? (
          <>
            <LoaderCircle className="spin" size={20} aria-hidden="true" />
            Entrando...
          </>
        ) : (
          <>
            Entrar
            <ArrowRight size={20} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}

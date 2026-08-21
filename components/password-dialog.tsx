"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, LoaderCircle, X } from "lucide-react";
import type { SafeSessionPayload } from "@/lib/types";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE, passwordPolicyMessage } from "@/lib/password-policy";

export function PasswordDialog({
  open,
  mandatory,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mandatory: boolean;
  onClose: () => void;
  onSuccess: (session: SafeSessionPayload) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => firstInput.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("Preencha todos os campos.");
      return;
    }
    const policyError = passwordPolicyMessage(newPassword);
    if (policyError) {
      setMessage(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("As novas senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const body = (await response.json()) as { session?: SafeSessionPayload; error?: { message?: string } };
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        setMessage(body.error?.message || "Não foi possível trocar a senha.");
        return;
      }
      if (!body.session) {
        setMessage("A senha foi alterada, mas não foi possível renovar sua sessão.");
        return;
      }
      setMessage("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSuccess(body.session);
    } catch {
      setMessage("Não foi possível conectar ao sistema.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-title"
      >
        <div className="dialog-heading">
          <span className="dialog-icon" aria-hidden="true"><KeyRound size={22} /></span>
          <div>
            <p className="eyebrow">Segurança</p>
            <h2 id="password-title">{mandatory ? "Crie uma nova senha" : "Trocar minha senha"}</h2>
          </div>
          {!mandatory ? (
            <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">
              <X size={20} />
            </button>
          ) : null}
        </div>

        {mandatory ? (
          <div className="mandatory-note">
            <CheckCircle2 size={18} aria-hidden="true" />
            Por segurança, troque a senha temporária antes de continuar.
          </div>
        ) : null}

        <form className="password-form" onSubmit={submit}>
          <div className="field-group">
            <label htmlFor="current-password">Senha atual</label>
            <input
              ref={firstInput}
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="field-group">
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              disabled={loading}
            />
            <small>{PASSWORD_POLICY_MESSAGE}</small>
          </div>
          <div className="field-group">
            <label htmlFor="confirm-password">Confirmar nova senha</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              disabled={loading}
            />
          </div>
          <div className={`form-feedback${message ? " form-feedback-visible" : ""}`} role="status">
            {message ? <AlertCircle size={17} aria-hidden="true" /> : null}
            <span>{message}</span>
          </div>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={20} /> : <KeyRound size={19} />}
            {loading ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}

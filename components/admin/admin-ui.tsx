"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";

export interface ApiErrorBody {
  error?: { code?: string; message?: string };
  message?: string;
}

export async function readApi<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) throw new Error(body.error?.message || "Não foi possível concluir a solicitação.");
  return body;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const active = status === "ATIVO" || status === "SUCESSO";
  const warning = status === "BLOQUEADO" || status === "SEGURANCA";
  return (
    <span className={`status-badge ${active ? "status-active" : warning ? "status-warning" : "status-inactive"}`}>
      <span />
      {status === "ATIVO"
        ? "Ativo"
        : status === "INATIVO"
          ? "Inativo"
          : status === "SUCESSO"
            ? "Sucesso"
            : status === "FALHA"
              ? "Falha"
              : status === "SEGURANCA"
                ? "Segurança"
                : status.replaceAll("_", " ")}
    </span>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="pagination-row">
      <span>{total === 1 ? "1 registro" : `${total} registros`}</span>
      <div>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Página anterior">
          <ChevronLeft size={18} />
        </button>
        <strong>{page} de {Math.max(totalPages, 1)}</strong>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function LoadingRows({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      <td colSpan={columns} className="table-state">
        <LoaderCircle className="spin" size={22} />
        Carregando informações...
      </td>
    </tr>
  );
}

export function EmptyRows({ columns = 5, message }: { columns?: number; message: string }) {
  return (
    <tr>
      <td colSpan={columns} className="table-state table-empty">{message}</td>
    </tr>
  );
}

export function Toast({
  message,
  kind = "success",
  onClose
}: {
  message: string;
  kind?: "success" | "error";
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div className={`toast toast-${kind}`} role="status">
      {kind === "success" ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Fechar mensagem"><X size={17} /></button>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading,
  danger = true,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <span className={`confirm-icon${danger ? " confirm-icon-danger" : ""}`}><AlertTriangle size={23} /></span>
        <div>
          <p className="eyebrow">Confirmação necessária</p>
          <h2 id="confirm-title">{title}</h2>
          <p>{description}</p>
        </div>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={loading}>Cancelar</button>
          <button className={danger ? "danger-button" : "primary-button compact-button"} type="button" onClick={onConfirm} disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

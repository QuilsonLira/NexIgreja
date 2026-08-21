"use client";
import {
  Database,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPageHeader, readApi, Toast } from "@/components/admin/admin-ui";
import { useWorkspace } from "@/components/protected-shell";

type HistoryRow = {
  id: number;
  export_type: string;
  format: string;
  record_count: number;
  status: string;
  created_at: string;
  actor_name: string;
};
function filename(header: string | null, fallback: string) {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}
export function DataExportManager() {
  const params = useSearchParams();
  const { hasPermission, session } = useWorkspace();
  const [format, setFormat] = useState("xlsx"),
    [busy, setBusy] = useState(""),
    [history, setHistory] = useState<HistoryRow[]>([]),
    [result, setResult] = useState<{
      format: string;
      records: string;
      date: string;
    } | null>(null),
    [toast, setToast] = useState({
      message: "",
      kind: "success" as "success" | "error",
    });
  const filters = {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    matrixId: params.get("matrixId") ?? "",
    branchId: params.get("branchId") ?? "",
  };
  const hasFilters = Object.values(filters).some(Boolean);
  async function loadHistory() {
    try {
      const body = await readApi<{ result: HistoryRow[] }>(
        await fetch("/api/admin/data-exports", { cache: "no-store" }),
      );
      setHistory(body.result);
    } catch (e) {
      setToast({
        message:
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o histórico.",
        kind: "error",
      });
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function download(
    kind: "members" | "departments" | "secretary" | "full" | "technical",
    selectedFormat: string,
  ) {
    if (
      !window.confirm(
        "Você está prestes a exportar dados da instituição. Deseja continuar?",
      )
    )
      return;
    setBusy(kind);
    try {
      const response = await fetch("/api/admin/data-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          format: selectedFormat,
          confirmed: true,
          filters: kind === "members" ? filters : undefined,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as {
          error?: { message?: string };
        };
        throw new Error(
          body.error?.message || "Não foi possível gerar a exportação.",
        );
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename(
        response.headers.get("Content-Disposition"),
        `nexigreja_exportacao.${selectedFormat}`,
      );
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      const records = response.headers.get("X-Export-Record-Count") ?? "0";
      setResult({
        format: selectedFormat.toUpperCase(),
        records,
        date: new Date().toLocaleString("pt-BR"),
      });
      setToast({
        message: "Exportação concluída e download iniciado.",
        kind: "success",
      });
      await loadHistory();
    } catch (e) {
      setToast({
        message:
          e instanceof Error
            ? e.message
            : "Não foi possível exportar os dados.",
        kind: "error",
      });
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <AdminPageHeader
        eyebrow="Administração"
        title="Dados e Exportação"
        description="Exporte dados autorizados para conferência, auditoria, backup ou migração, sempre dentro do seu alcance."
      />
      <section className="export-warning">
        <ShieldCheck size={22} />
        <div>
          <strong>Download protegido</strong>
          <span>
            A sessão, a instituição, o alcance e a permissão são validados
            novamente. Senhas, tokens, sessões e segredos nunca são incluídos.
          </span>
        </div>
      </section>
      <div className="export-grid">
        <article className="content-card export-card">
          <span className="export-icon">
            <FileSpreadsheet />
          </span>
          <div>
            <p className="eyebrow">Relatório</p>
            <h2>Exportar membros</h2>
            <p>
              Inclui dados cadastrais, título de eleitor, unidade, função e
              campos personalizados.
            </p>
          </div>
          <label className="field-group">
            <span>Formato</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV UTF-8 (.csv)</option>
              <option value="json">JSON estruturado (.json)</option>
            </select>
          </label>
          <button
            className="primary-button"
            onClick={() => void download("members", format)}
            disabled={Boolean(busy)}
          >
            {busy === "members" ? (
              <LoaderCircle className="spin" size={18} />
            ) : format === "json" ? (
              <FileJson size={18} />
            ) : (
              <Download size={18} />
            )}
            Exportar
          </button>
        </article>
        {hasPermission("DEPARTAMENTO_RELATORIOS") ? (
          <article className="content-card export-card">
            <span className="export-icon">
              <FileSpreadsheet />
            </span>
            <div>
              <p className="eyebrow">Departamentos e EBD</p>
              <h2>Exportar indicadores</h2>
              <p>
                Inclui departamentos, participantes, classes, presenças,
                visitantes e ofertas registradas.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => void download("departments", "xlsx")}
              disabled={Boolean(busy)}
            >
              {busy === "departments" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Download size={18} />
              )}
              Exportar Excel
            </button>
          </article>
        ) : null}
        {hasPermission("SECRETARIA_RELATORIOS") ? (
          <article className="content-card export-card">
            <span className="export-icon">
              <FileSpreadsheet />
            </span>
            <div>
              <p className="eyebrow">Secretaria Eclesiástica</p>
              <h2>Exportar histórico</h2>
              <p>
                Inclui movimentações e documentos emitidos no alcance da sua
                unidade.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => void download("secretary", "xlsx")}
              disabled={Boolean(busy)}
            >
              {busy === "secretary" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Download size={18} />
              )}
              Exportar Excel
            </button>
          </article>
        ) : null}
        <article className="content-card export-card">
          <span className="export-icon export-icon-gold">
            <FileArchive />
          </span>
          <div>
            <p className="eyebrow">Portabilidade</p>
            <h2>Exportação completa</h2>
            <p>
              Gera um ZIP com manifesto, membros, usuários, unidades, funções,
              históricos, campos personalizados e fotos permitidas.
            </p>
          </div>
          {hasPermission("DADOS_EXPORTAR_COMPLETO") ? (
            <button
              className="primary-button"
              onClick={() => void download("full", "zip")}
              disabled={Boolean(busy)}
            >
              {busy === "full" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <FileArchive size={18} />
              )}
              Gerar pacote
            </button>
          ) : (
            <small>
              Disponível somente ao administrador máximo autorizado.
            </small>
          )}
          {session.user.isPlatformOwner &&
          hasPermission("DADOS_EXPORTAR_COMPLETO") ? (
            <button
              className="secondary-button"
              onClick={() => void download("technical", "zip")}
              disabled={Boolean(busy)}
            >
              {busy === "technical" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Database size={18} />
              )}
              Pacote técnico
            </button>
          ) : null}
        </article>
      </div>
      {hasFilters ? (
        <p className="export-filter-note">
          A exportação de membros usará os filtros recebidos da listagem:{" "}
          {filters.search ||
            filters.status ||
            filters.branchId ||
            filters.matrixId}
          .
        </p>
      ) : null}
      {result ? (
        <section className="content-card export-result">
          <span>
            <ShieldCheck size={24} />
          </span>
          <div>
            <p className="eyebrow">Exportação concluída</p>
            <h2>{result.format}</h2>
            <p>
              {result.records} registros incluídos · {result.date}
            </p>
          </div>
        </section>
      ) : null}
      <section className="content-card admin-list-card">
        <div className="card-heading">
          <span className="card-icon">
            <Database size={20} />
          </span>
          <div>
            <p className="eyebrow">Auditoria</p>
            <h2>Histórico de exportações</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Tipo</th>
                <th>Formato</th>
                <th>Registros</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                    <td>{row.actor_name}</td>
                    <td>{row.export_type}</td>
                    <td>{row.format}</td>
                    <td>{row.record_count}</td>
                    <td>{row.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>Nenhuma exportação realizada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Toast {...toast} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

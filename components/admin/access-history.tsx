"use client";

import { useEffect, useState } from "react";
import { CalendarDays, History, Search, ShieldCheck } from "lucide-react";
import {
  AdminPageHeader,
  EmptyRows,
  LoadingRows,
  Pagination,
  readApi,
  StatusBadge,
  Toast
} from "@/components/admin/admin-ui";
import type { IdentifierType } from "@/lib/auth/types";
import type { AccessHistoryRecord, AccessResult, PageResult } from "@/lib/admin/types";

const eventLabels: Record<string, string> = {
  LOGIN_SUCESSO: "Entrada autorizada",
  LOGIN_RECUSADO: "Entrada recusada",
  BLOQUEIO_TEMPORARIO: "Bloqueio temporário",
  LOGOUT: "Saída do sistema",
  TROCA_SENHA: "Senha alterada",
  REDEFINICAO_SENHA: "Senha redefinida",
  TROCA_CONTEXTO: "Unidade alterada",
  ACESSO_FORA_ESCOPO: "Acesso fora do escopo",
  SESSAO_REVOGADA: "Sessão encerrada"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

export function AccessHistoryManager() {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<AccessResult | "">("");
  const [method, setMethod] = useState<IdentifierType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<AccessHistoryRecord>>({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", kind: "error" as "success" | "error" });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "10" });
        if (search.trim()) params.set("search", search.trim());
        if (resultFilter) params.set("result", resultFilter);
        if (method) params.set("identifierType", method);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
        const body = await readApi<{ result: PageResult<AccessHistoryRecord> }>(
          await fetch(`/api/admin/access-history?${params}`, { signal: controller.signal, cache: "no-store" })
        );
        setResult(body.result);
      } catch (error) {
        if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar o histórico.", kind: "error" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [search, resultFilter, method, dateFrom, dateTo, page]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Auditoria de autenticação"
        title="Histórico de acessos"
        description="Consulte entradas, falhas e eventos de segurança visíveis dentro do seu escopo."
      />
      <section className="history-summary content-card">
        <span className="history-summary-icon"><ShieldCheck size={22} /></span>
        <div><strong>Credenciais protegidas</strong><p>O histórico mostra o método usado, mas nunca exibe CPF, e-mail completo, senha ou token.</p></div>
        <History size={24} />
      </section>
      <section className="content-card admin-list-card">
        <div className="filter-bar history-filters">
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar usuário, dispositivo ou IP" aria-label="Pesquisar histórico" /></label>
          <select value={resultFilter} onChange={(event) => { setResultFilter(event.target.value as AccessResult | ""); setPage(1); }} aria-label="Filtrar por resultado"><option value="">Todos os resultados</option><option value="SUCESSO">Sucesso</option><option value="FALHA">Falha</option><option value="SEGURANCA">Segurança</option></select>
          <select value={method} onChange={(event) => { setMethod(event.target.value as IdentifierType | ""); setPage(1); }} aria-label="Filtrar por método"><option value="">Todos os métodos</option><option value="CPF">CPF</option><option value="USUARIO">Nome de usuário</option><option value="EMAIL">E-mail</option></select>
          <label className="date-field"><span>De</span><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
          <label className="date-field"><span>Até</span><input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
        </div>
        <div className="table-wrap">
          <table className="admin-table history-table">
            <thead><tr><th>Data e hora</th><th>Usuário</th><th>Evento</th><th>Método</th><th>Origem</th><th>Unidade</th></tr></thead>
            <tbody>
              {loading ? <LoadingRows columns={6} /> : null}
              {!loading && !result.items.length ? <EmptyRows columns={6} message="Nenhum acesso encontrado com esses filtros." /> : null}
              {!loading ? result.items.map((entry) => (
                <tr key={entry.id}>
                  <td><div className="date-cell"><CalendarDays size={16} /><strong>{formatDate(entry.occurredAt)}</strong></div></td>
                  <td><strong className="table-primary-text">{entry.userName}</strong>{entry.username ? <small>@{entry.username}</small> : null}</td>
                  <td><strong className="table-primary-text">{eventLabels[entry.event] ?? entry.event.replaceAll("_", " ")}</strong><StatusBadge status={entry.result} /></td>
                  <td>{entry.identifierType ? ({ CPF: "CPF", USUARIO: "Usuário", EMAIL: "E-mail" } as const)[entry.identifierType] : "—"}</td>
                  <td><strong className="table-primary-text">{entry.originSummary}</strong><small>{entry.ipAddress ?? "IP não disponível"}</small></td>
                  <td>{entry.unitName ?? "—"}</td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
      </section>
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

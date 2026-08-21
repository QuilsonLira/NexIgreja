"use client";

import { useEffect, useState } from "react";
import { Archive, Building2, Edit3, ListChecks, LoaderCircle, Plus, Power, PowerOff, RotateCcw, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { AdminPageHeader, ConfirmDialog, EmptyRows, LoadingRows, Pagination, readApi, StatusBadge, Toast } from "@/components/admin/admin-ui";
import type { AdminUnitStatus, AdminUnitType, DeletionAssessment, PageResult, TenantRecord, UnitRecord } from "@/lib/admin/types";
import { permanentDeletionPhrase } from "@/lib/platform/policy";
import { useWorkspace } from "@/components/protected-shell";

const typeLabels: Record<AdminUnitType, string> = { CONVENCAO: "Convenção", MATRIZ: "Matriz", FILIAL: "Filial" };

type ConventionFields = {
  tenantId: number | null;
  name: string; fantasyName: string; legalName: string; cnpj: string; phone: string;
  whatsapp: string; email: string; city: string; state: string; responsibleName: string; notes: string;
};

function conventionFields(unit: UnitRecord | null): ConventionFields {
  return {
    tenantId: unit?.tenantId ?? null,
    name: unit?.name ?? "", fantasyName: unit?.fantasyName ?? "", legalName: unit?.legalName ?? "",
    cnpj: unit?.cnpj ?? "", phone: unit?.phone ?? "", whatsapp: unit?.whatsapp ?? "",
    email: unit?.email ?? "", city: unit?.city ?? "", state: unit?.state ?? "",
    responsibleName: unit?.responsibleName ?? "", notes: unit?.notes ?? "",
  };
}

function ConventionDialog({ unit, onClose, onSaved }: { unit: UnitRecord | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [fields, setFields] = useState(() => conventionFields(unit));
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setField = (field: Exclude<keyof ConventionFields, "tenantId">, value: string) => setFields((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (unit) return;
    let active = true;
    void fetch("/api/platform/tenants?status=ATIVO&pageSize=50", { cache: "no-store" }).then((response) => readApi<{ result: PageResult<TenantRecord> }>(response))
      .then((body) => { if (active) { setTenants(body.result.items); setFields((current) => ({ ...current, tenantId: current.tenantId ?? body.result.items[0]?.id ?? null })); } })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar os clientes."); });
    return () => { active = false; };
  }, [unit]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const body = await readApi<{ message: string }>(await fetch(unit ? `/api/platform/conventions/${unit.id}` : "/api/platform/conventions", {
        method: unit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      }));
      onSaved(body.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar a Convenção.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card admin-form-dialog platform-form-dialog" role="dialog" aria-modal="true" aria-labelledby="platform-convention-title">
        <div className="dialog-heading"><span className="dialog-icon"><Building2 size={22} /></span><div><p className="eyebrow">Administração do NexIgreja</p><h2 id="platform-convention-title">{unit ? "Editar Convenção" : "Cadastrar Convenção"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
        <form className="admin-form" onSubmit={submit}>
          <div className="form-section"><div className="form-section-heading"><strong>Identificação institucional</strong><span>Dados independentes desta Convenção</span></div><div className="form-grid">
            <div className="field-group form-span-2"><label htmlFor="platform-tenant">Cliente SaaS</label>{unit ? <input id="platform-tenant" value={`Tenant #${unit.tenantId}`} disabled /> : <select id="platform-tenant" value={fields.tenantId ?? ""} onChange={(event) => setFields((current) => ({ ...current, tenantId: Number(event.target.value) }))} required disabled={loading}><option value="">Selecione o cliente</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select>}</div>
            <div className="field-group form-span-2"><label htmlFor="platform-name">Nome da Convenção</label><input id="platform-name" value={fields.name} onChange={(event) => setField("name", event.target.value)} maxLength={150} required autoFocus disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-legal">Razão social</label><input id="platform-legal" value={fields.legalName} onChange={(event) => setField("legalName", event.target.value)} maxLength={180} disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-fantasy">Nome fantasia</label><input id="platform-fantasy" value={fields.fantasyName} onChange={(event) => setField("fantasyName", event.target.value)} maxLength={150} disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-cnpj">CNPJ</label><input id="platform-cnpj" value={fields.cnpj} onChange={(event) => setField("cnpj", event.target.value)} maxLength={18} inputMode="numeric" disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-responsible">Responsável</label><input id="platform-responsible" value={fields.responsibleName} onChange={(event) => setField("responsibleName", event.target.value)} maxLength={150} disabled={loading} /></div>
          </div></div>
          <div className="form-section"><div className="form-section-heading"><strong>Contato e localização</strong><span>Informações administrativas</span></div><div className="form-grid">
            <div className="field-group"><label htmlFor="platform-phone">Telefone</label><input id="platform-phone" value={fields.phone} onChange={(event) => setField("phone", event.target.value)} maxLength={20} disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-whatsapp">WhatsApp</label><input id="platform-whatsapp" value={fields.whatsapp} onChange={(event) => setField("whatsapp", event.target.value)} maxLength={20} disabled={loading} /></div>
            <div className="field-group form-span-2"><label htmlFor="platform-email">E-mail</label><input id="platform-email" type="email" value={fields.email} onChange={(event) => setField("email", event.target.value)} maxLength={254} disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-city">Cidade</label><input id="platform-city" value={fields.city} onChange={(event) => setField("city", event.target.value)} maxLength={120} disabled={loading} /></div>
            <div className="field-group"><label htmlFor="platform-state">UF</label><input id="platform-state" value={fields.state} onChange={(event) => setField("state", event.target.value.toUpperCase())} maxLength={2} disabled={loading} /></div>
            <div className="field-group form-span-2"><label htmlFor="platform-notes">Observações</label><textarea id="platform-notes" value={fields.notes} onChange={(event) => setField("notes", event.target.value)} maxLength={1000} rows={3} disabled={loading} /></div>
          </div></div>
          <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error}</div>
          <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button><button className="primary-button compact-button" type="submit" disabled={loading || !fields.name.trim() || !fields.tenantId}>{loading ? <LoaderCircle className="spin" size={18} /> : null}{loading ? "Salvando..." : "Salvar Convenção"}</button></div>
        </form>
      </section>
    </div>
  );
}

export function PlatformConventionsManager() {
  const { refreshSession } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminUnitStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<UnitRecord>>({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<UnitRecord | null | undefined>(undefined);
  const [statusUnit, setStatusUnit] = useState<UnitRecord | null>(null);
  const [archiveUnit, setArchiveUnit] = useState<UnitRecord | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState({ message: "", kind: "success" as "success" | "error" });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "10" });
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        const body = await readApi<{ result: PageResult<UnitRecord> }>(await fetch(`/api/platform/conventions?${params}`, { cache: "no-store", signal: controller.signal }));
        setResult(body.result);
      } catch (error) {
        if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar as Convenções.", kind: "error" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [search, status, page, refresh]);

  function saved(message: string) { setEditing(undefined); setToast({ message, kind: "success" }); setRefresh((value) => value + 1); }

  async function changeStatus() {
    if (!statusUnit || mutating) return;
    setMutating(true);
    const nextStatus = statusUnit.status === "ATIVO" ? "INATIVO" : "ATIVO";
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/platform/conventions/${statusUnit.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }));
      setToast({ message: body.message, kind: "success" }); setStatusUnit(null); setRefresh((value) => value + 1); await refreshSession();
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Não foi possível alterar a Convenção.", kind: "error" }); setStatusUnit(null); }
    finally { setMutating(false); }
  }

  async function archive() {
    if (!archiveUnit || mutating) return;
    setMutating(true);
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/platform/units/convencao/${archiveUnit.id}/archive`, { method: "POST" }));
      setToast({ message: body.message, kind: "success" }); setArchiveUnit(null); setRefresh((value) => value + 1); await refreshSession();
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Não foi possível arquivar a Convenção.", kind: "error" }); setArchiveUnit(null); }
    finally { setMutating(false); }
  }

  return <>
    <AdminPageHeader eyebrow="Administração do NexIgreja" title="Convenções" description="Gerencie os escopos organizacionais independentes da plataforma. Esta área não utiliza permissões delegáveis." action={<button className="primary-button compact-button" type="button" onClick={() => setEditing(null)}><Plus size={19} /> Nova Convenção</button>} />
    <section className="platform-owner-banner"><ShieldAlert size={21} /><div><strong>Área exclusiva do proprietário</strong><span>As ações são validadas no servidor e registradas em auditoria própria da plataforma.</span></div></section>
    <section className="content-card admin-list-card"><div className="filter-bar"><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, CNPJ ou cidade" aria-label="Pesquisar Convenções" /></label><select value={status} onChange={(event) => { setStatus(event.target.value as AdminUnitStatus | ""); setPage(1); }} aria-label="Filtrar status"><option value="">Todos os status</option><option value="ATIVO">Ativas</option><option value="INATIVO">Inativas</option></select></div>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>Convenção</th><th>Cidade / UF</th><th>CNPJ</th><th>Responsável</th><th>Status</th><th className="actions-column">Ações</th></tr></thead><tbody>
        {loading ? <LoadingRows columns={6} /> : null}{!loading && !result.items.length ? <EmptyRows columns={6} message="Nenhuma Convenção encontrada." /> : null}
        {!loading ? result.items.map((unit) => <tr key={unit.id}><td><strong>{unit.name}</strong><small>{unit.legalName ?? unit.fantasyName ?? "Escopo organizacional independente"}</small></td><td>{unit.city ? `${unit.city}${unit.state ? ` / ${unit.state}` : ""}` : "—"}</td><td>{unit.cnpj ?? "—"}</td><td>{unit.responsibleName ?? "—"}</td><td><StatusBadge status={unit.status} /></td><td><div className="row-actions"><button type="button" onClick={() => setEditing(unit)} title="Editar" aria-label={`Editar ${unit.name}`}><Edit3 size={17} /></button><button className={unit.status === "ATIVO" ? "action-danger" : "action-success"} type="button" onClick={() => setStatusUnit(unit)} title={unit.status === "ATIVO" ? "Desativar" : "Ativar"}>{unit.status === "ATIVO" ? <PowerOff size={17} /> : <Power size={17} />}</button>{unit.status === "INATIVO" ? <button className="action-danger" type="button" onClick={() => setArchiveUnit(unit)} title="Arquivar"><Archive size={17} /></button> : null}</div></td></tr>) : null}
      </tbody></table></div><Pagination page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} /></section>
    {editing !== undefined ? <ConventionDialog key={editing?.id ?? "new"} unit={editing} onClose={() => setEditing(undefined)} onSaved={saved} /> : null}
    <ConfirmDialog open={Boolean(statusUnit)} title={statusUnit?.status === "ATIVO" ? "Desativar esta Convenção?" : "Ativar esta Convenção?"} description={`A Convenção “${statusUnit?.name ?? ""}” e seus acessos responderão ao novo status sem apagar dados.`} confirmLabel={statusUnit?.status === "ATIVO" ? "Desativar Convenção" : "Ativar Convenção"} loading={mutating} danger={statusUnit?.status === "ATIVO"} onCancel={() => setStatusUnit(null)} onConfirm={() => void changeStatus()} />
    <ConfirmDialog open={Boolean(archiveUnit)} title="Arquivar esta Convenção?" description={`“${archiveUnit?.name ?? ""}” deixará a operação normal, junto com sua estrutura subordinada. Todo o histórico será preservado e poderá ser restaurado.`} confirmLabel="Arquivar Convenção" loading={mutating} onCancel={() => setArchiveUnit(null)} onConfirm={() => void archive()} />
    <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} />
  </>;
}

function PermanentDeleteDialog({ unit, onClose, onDeleted }: { unit: UnitRecord | null; onClose: () => void; onDeleted: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!unit) return null;
  const phrase = permanentDeletionPhrase(unit.name);
  async function remove() {
    if (loading || !unit) return;
    setLoading(true); setError("");
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/platform/units/${unit.type.toLowerCase()}/${unit.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) }));
      onDeleted(body.message);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível excluir a unidade."); }
    finally { setLoading(false); }
  }
  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card permanent-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="permanent-delete-title"><div className="dialog-heading"><span className="dialog-icon danger-dialog-icon"><Trash2 size={22} /></span><div><p className="eyebrow">Operação irreversível</p><h2 id="permanent-delete-title">Exclusão definitiva</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div><div className="destructive-unit-summary"><span>{typeLabels[unit.type]}</span><strong>{unit.name}</strong></div><p className="destructive-warning">A exclusão só será permitida se não houver usuários, unidades subordinadas, sessões, históricos, lançamentos ou outros registros relacionados.</p><div className="field-group"><label htmlFor="owner-password">Confirme sua senha</label><input id="owner-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div><div className="field-group"><label htmlFor="owner-confirmation">Digite exatamente: <strong>{phrase}</strong></label><input id="owner-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></div><div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error}</div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button><button className="danger-button" type="button" onClick={() => void remove()} disabled={loading || !password || confirmation !== phrase}>{loading ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}{loading ? "Verificando..." : "Excluir definitivamente"}</button></div></section></div>;
}

function UnitDeletionAssessmentDialog({ unit, onClose }: { unit: UnitRecord | null; onClose: () => void }) {
  const [assessment, setAssessment] = useState<DeletionAssessment | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!unit) return;
    let active = true;
    void (async () => {
      try {
        const body = await readApi<{ assessment: DeletionAssessment }>(await fetch(`/api/platform/units/${unit.type.toLowerCase()}/${unit.id}/dependencies`, { cache: "no-store" }));
        if (active) setAssessment(body.assessment);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Não foi possível verificar as dependências.");
      }
    })();
    return () => { active = false; };
  }, [unit]);
  if (!unit) return null;
  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card dependency-dialog" role="dialog" aria-modal="true" aria-labelledby="unit-dependency-title"><div className="dialog-heading"><span className="dialog-icon"><ListChecks size={22} /></span><div><p className="eyebrow">Verificação de integridade</p><h2 id="unit-dependency-title">Verificar exclusão</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div><div className="destructive-unit-summary"><span>{typeLabels[unit.type]}</span><strong>{unit.name}</strong></div>{!assessment && !error ? <div className="dependency-loading"><LoaderCircle className="spin" size={22} /> Verificando dependências...</div> : null}{error ? <div className="form-feedback form-feedback-visible">{error}</div> : null}{assessment ? <><div className={`deletion-verdict ${assessment.canDelete ? "deletion-verdict-yes" : "deletion-verdict-no"}`}><strong>Pode ser excluída definitivamente: {assessment.canDelete ? "SIM" : "NÃO"}</strong><span>{assessment.summary}</span></div>{assessment.dependencies.length ? <ul className="dependency-list">{assessment.dependencies.map((item) => <li key={item.source}><strong>{item.count}</strong><span>{item.label}</span></li>)}</ul> : <p className="destructive-warning">Nenhuma dependência relevante foi encontrada.</p>}</> : null}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Fechar</button></div></section></div>;
}

export function ArchivedUnitsManager() {
  const { refreshSession } = useWorkspace();
  const [search, setSearch] = useState(""); const [type, setType] = useState<AdminUnitType | "">(""); const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<UnitRecord>>({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true); const [refresh, setRefresh] = useState(0); const [restoring, setRestoring] = useState<UnitRecord | null>(null); const [assessing, setAssessing] = useState<UnitRecord | null>(null); const [deleting, setDeleting] = useState<UnitRecord | null>(null); const [mutating, setMutating] = useState(false); const [toast, setToast] = useState({ message: "", kind: "success" as "success" | "error" });
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(async () => { setLoading(true); try { const params = new URLSearchParams({ page: String(page), pageSize: "10" }); if (search.trim()) params.set("search", search.trim()); if (type) params.set("type", type); const body = await readApi<{ result: PageResult<UnitRecord> }>(await fetch(`/api/platform/archived-units?${params}`, { cache: "no-store", signal: controller.signal })); setResult(body.result); } catch (error) { if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar as unidades arquivadas.", kind: "error" }); } finally { if (!controller.signal.aborted) setLoading(false); } }, 180); return () => { controller.abort(); clearTimeout(timer); }; }, [search, type, page, refresh]);
  async function restore() { if (!restoring || mutating) return; setMutating(true); try { const body = await readApi<{ message: string }>(await fetch(`/api/platform/units/${restoring.type.toLowerCase()}/${restoring.id}/restore`, { method: "POST" })); setToast({ message: body.message, kind: "success" }); setRestoring(null); setRefresh((value) => value + 1); await refreshSession(); } catch (error) { setToast({ message: error instanceof Error ? error.message : "Não foi possível restaurar a unidade.", kind: "error" }); setRestoring(null); } finally { setMutating(false); } }
  return <><AdminPageHeader eyebrow="Administração do NexIgreja" title="Unidades arquivadas" description="Restaure unidades preservadas ou trate exclusões definitivas excepcionais e sem dependências." /><section className="platform-owner-banner platform-owner-banner-neutral"><Archive size={21} /><div><strong>Histórico preservado</strong><span>Arquivar é a operação recomendada. A exclusão definitiva permanece bloqueada sempre que houver qualquer dependência relevante.</span></div></section><section className="content-card admin-list-card"><div className="filter-bar"><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome ou vínculo" aria-label="Pesquisar unidades arquivadas" /></label><select value={type} onChange={(event) => { setType(event.target.value as AdminUnitType | ""); setPage(1); }}><option value="">Todos os tipos</option><option value="CONVENCAO">Convenção</option><option value="MATRIZ">Matriz</option><option value="FILIAL">Filial</option></select></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Unidade</th><th>Tipo</th><th>Convenção</th><th>Arquivada em</th><th>Arquivada por</th><th className="actions-column">Ações</th></tr></thead><tbody>{loading ? <LoadingRows columns={6} /> : null}{!loading && !result.items.length ? <EmptyRows columns={6} message="Nenhuma unidade arquivada." /> : null}{!loading ? result.items.map((unit) => <tr key={`${unit.type}-${unit.id}`}><td><strong>{unit.name}</strong><small>{unit.parentName ?? "Unidade principal"}</small></td><td><span className={`unit-type unit-type-${unit.type.toLowerCase()}`}>{typeLabels[unit.type]}</span></td><td>{unit.conventionName}</td><td>{unit.archivedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(unit.archivedAt)) : "—"}</td><td>{unit.archivedByName ?? "Proprietário"}</td><td><div className="row-actions"><button className="action-success" type="button" onClick={() => setRestoring(unit)} title="Restaurar"><RotateCcw size={17} /></button><button type="button" onClick={() => setAssessing(unit)} title="Verificar exclusão"><ListChecks size={17} /></button><button className="action-danger" type="button" onClick={() => setDeleting(unit)} title="Excluir definitivamente"><Trash2 size={17} /></button></div></td></tr>) : null}</tbody></table></div><Pagination page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} /></section><ConfirmDialog open={Boolean(restoring)} title="Restaurar esta unidade?" description={`“${restoring?.name ?? ""}” voltará à operação normal com o status que possuía antes do arquivamento.`} confirmLabel="Restaurar unidade" loading={mutating} danger={false} onCancel={() => setRestoring(null)} onConfirm={() => void restore()} /><UnitDeletionAssessmentDialog unit={assessing} onClose={() => setAssessing(null)} /><PermanentDeleteDialog unit={deleting} onClose={() => setDeleting(null)} onDeleted={(message) => { setDeleting(null); setToast({ message, kind: "success" }); setRefresh((value) => value + 1); }} /><Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} /></>;
}

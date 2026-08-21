"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Edit3, LoaderCircle, Plus, Power, PowerOff, Search, X } from "lucide-react";
import { useWorkspace } from "@/components/protected-shell";
import { AdminPageHeader, ConfirmDialog, EmptyRows, LoadingRows, readApi, StatusBadge, Toast } from "@/components/admin/admin-ui";
import type { OrganizationalFunctionRecord } from "@/lib/admin/types";

function FunctionDialog({ value, onClose, onSaved }: { value: OrganizationalFunctionRecord | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [name, setName] = useState(value?.name ?? "");
  const [description, setDescription] = useState(value?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const body = await readApi<{ message: string }>(await fetch(value ? `/api/admin/functions/${value.id}` : "/api/admin/functions", { method: value ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) }));
      onSaved(body.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar a função.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card admin-form-dialog" role="dialog" aria-modal="true" aria-labelledby="function-dialog-title">
    <div className="dialog-heading"><span className="dialog-icon"><Briefcase size={22} /></span><div><p className="eyebrow">Estrutura de pessoas</p><h2 id="function-dialog-title">{value ? "Editar função" : "Nova função"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div>
    <form className="admin-form" onSubmit={submit}><div className="form-section"><div className="form-section-heading"><strong>Dados da função</strong><span>Função organizacional não concede permissões</span></div><div className="form-grid"><div className="field-group form-span-2"><label htmlFor="function-name">Nome</label><input id="function-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} disabled={loading} required autoFocus placeholder="Ex.: Pastor, Secretário, Tesoureiro" /></div><div className="field-group form-span-2"><label htmlFor="function-description">Descrição</label><textarea id="function-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} disabled={loading} /></div></div></div>
      <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error}</div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button><button className="primary-button compact-button" type="submit" disabled={loading || name.trim().length < 2}>{loading ? <LoaderCircle className="spin" size={18} /> : null}{loading ? "Salvando..." : "Salvar função"}</button></div>
    </form>
  </section></div>;
}

export function FunctionsManager() {
  const { hasPermission, refreshSession } = useWorkspace();
  const [items, setItems] = useState<OrganizationalFunctionRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "ATIVO" | "INATIVO">("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationalFunctionRecord | null>(null);
  const [confirming, setConfirming] = useState<OrganizationalFunctionRecord | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState({ message: "", kind: "success" as "success" | "error" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/functions", { signal: controller.signal, cache: "no-store" }).then((response) => readApi<{ functions: OrganizationalFunctionRecord[] }>(response)).then((body) => setItems(body.functions)).catch((error) => { if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar as funções.", kind: "error" }); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const filtered = useMemo(() => items.filter((item) => (!status || item.status === status) && (!search.trim() || `${item.name} ${item.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))), [items, search, status]);

  function saved(message: string) {
    setDialogOpen(false);
    setEditing(null);
    setToast({ message, kind: "success" });
    setLoading(true);
    setRefresh((current) => current + 1);
    void refreshSession();
  }

  async function changeStatus() {
    if (!confirming || mutating) return;
    setMutating(true);
    try {
      const nextStatus = confirming.status === "ATIVO" ? "INATIVO" : "ATIVO";
      const body = await readApi<{ message: string }>(await fetch(`/api/admin/functions/${confirming.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }));
      setToast({ message: body.message, kind: "success" });
      setConfirming(null);
      setLoading(true);
      setRefresh((current) => current + 1);
      await refreshSession();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Não foi possível alterar a função.", kind: "error" });
      setConfirming(null);
    } finally { setMutating(false); }
  }

  return <><AdminPageHeader eyebrow="Estrutura de pessoas" title="Funções" description="Cadastre as funções usadas nos vínculos desta organização. Permissões continuam sendo configuradas separadamente." action={hasPermission("FUNCOES_CRIAR") ? <button className="primary-button compact-button" type="button" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={19} /> Nova função</button> : undefined} />
    <section className="content-card admin-list-card"><div className="filter-bar"><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou descrição" aria-label="Pesquisar funções" /></label><select value={status} onChange={(event) => setStatus(event.target.value as "" | "ATIVO" | "INATIVO")} aria-label="Filtrar por status"><option value="">Todos os status</option><option value="ATIVO">Ativas</option><option value="INATIVO">Inativas</option></select></div>
      <div className="table-wrap"><table className="admin-table"><thead><tr><th>Função</th><th>Descrição</th><th>Vínculos</th><th>Status</th><th className="actions-column">Ações</th></tr></thead><tbody>{loading ? <LoadingRows columns={5} /> : null}{!loading && !filtered.length ? <EmptyRows columns={5} message="Nenhuma função encontrada." /> : null}{!loading ? filtered.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.description ?? "—"}</td><td>{item.membershipCount}</td><td><StatusBadge status={item.status} /></td><td><div className="row-actions">{hasPermission("FUNCOES_EDITAR") ? <button type="button" onClick={() => { setEditing(item); setDialogOpen(true); }} title="Editar" aria-label={`Editar ${item.name}`}><Edit3 size={17} /></button> : null}{hasPermission("FUNCOES_DESATIVAR") ? <button className={item.status === "ATIVO" ? "action-danger" : "action-success"} type="button" onClick={() => setConfirming(item)} title={item.status === "ATIVO" ? "Desativar" : "Ativar"} aria-label={`${item.status === "ATIVO" ? "Desativar" : "Ativar"} ${item.name}`}>{item.status === "ATIVO" ? <PowerOff size={17} /> : <Power size={17} />}</button> : null}</div></td></tr>) : null}</tbody></table></div>
    </section>
    {dialogOpen ? <FunctionDialog key={editing?.id ?? "new"} value={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} onSaved={saved} /> : null}
    <ConfirmDialog open={Boolean(confirming)} title={confirming?.status === "ATIVO" ? "Desativar esta função?" : "Ativar esta função?"} description={confirming?.status === "ATIVO" ? `“${confirming?.name ?? ""}” não poderá ser escolhida em novos vínculos. Os ${confirming?.membershipCount ?? 0} vínculos existentes serão preservados.` : `“${confirming?.name ?? ""}” voltará a aparecer nos seletores.`} confirmLabel={confirming?.status === "ATIVO" ? "Desativar função" : "Ativar função"} loading={mutating} danger={confirming?.status === "ATIVO"} onCancel={() => setConfirming(null)} onConfirm={() => void changeStatus()} />
    <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} /></>;
}

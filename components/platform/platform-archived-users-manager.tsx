"use client";

import { useEffect, useState } from "react";
import { ListChecks, LoaderCircle, RotateCcw, Search, Trash2, UserX, X } from "lucide-react";
import { AdminPageHeader, ConfirmDialog, EmptyRows, LoadingRows, Pagination, readApi, Toast } from "@/components/admin/admin-ui";
import { UserAvatar } from "@/components/media-display";
import type { DeletionAssessment, PageResult, UserRecord } from "@/lib/admin/types";
import type { OrganizationalScope } from "@/lib/types";
import { userPermanentDeletionPhrase } from "@/lib/platform/policy";

const scopeLabels: Record<OrganizationalScope, string> = { CONVENCAO: "Convenção", MATRIZ: "Matriz", FILIAL: "Filial" };

function userUnit(user: UserRecord): string {
  return user.scope === "CONVENCAO" ? "Convenção" : user.scope === "MATRIZ" ? user.matrixName ?? "Matriz" : user.branchName ?? "Filial";
}

function AssessmentDialog({ user, onClose }: { user: UserRecord | null; onClose: () => void }) {
  const [assessment, setAssessment] = useState<DeletionAssessment | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const body = await readApi<{ assessment: DeletionAssessment }>(await fetch(`/api/platform/users/${user.id}/dependencies`, { cache: "no-store" }));
        if (active) setAssessment(body.assessment);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Não foi possível verificar as dependências.");
      }
    })();
    return () => { active = false; };
  }, [user]);
  if (!user) return null;
  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card dependency-dialog" role="dialog" aria-modal="true" aria-labelledby="user-assessment-title"><div className="dialog-heading"><span className="dialog-icon"><ListChecks size={22} /></span><div><p className="eyebrow">Verificação de integridade</p><h2 id="user-assessment-title">Verificar exclusão</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div><div className="destructive-unit-summary"><span>Usuário</span><strong>{user.name}</strong></div>{!assessment && !error ? <div className="dependency-loading"><LoaderCircle className="spin" size={22} /> Verificando histórico...</div> : null}{error ? <div className="form-feedback form-feedback-visible">{error}</div> : null}{assessment ? <><div className={`deletion-verdict ${assessment.canDelete ? "deletion-verdict-yes" : "deletion-verdict-no"}`}><strong>Pode ser excluído definitivamente: {assessment.canDelete ? "SIM" : "NÃO"}</strong><span>{assessment.summary}</span></div>{assessment.dependencies.length ? <ul className="dependency-list">{assessment.dependencies.map((item) => <li key={item.source}><strong>{item.count}</strong><span>{item.label}</span></li>)}</ul> : <p className="destructive-warning">Nenhuma dependência relevante foi encontrada.</p>}</> : null}<div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose}>Fechar</button></div></section></div>;
}

function DeleteUserDialog({ user, onClose, onDeleted }: { user: UserRecord | null; onClose: () => void; onDeleted: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!user) return null;
  const target = user;
  const phrase = userPermanentDeletionPhrase(target.name);
  async function remove() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/platform/users/${target.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmation }) }));
      onDeleted(body.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível excluir o usuário.");
    } finally { setLoading(false); }
  }
  return <div className="dialog-backdrop" role="presentation"><section className="dialog-card permanent-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title"><div className="dialog-heading"><span className="dialog-icon danger-dialog-icon"><Trash2 size={22} /></span><div><p className="eyebrow">Operação irreversível</p><h2 id="delete-user-title">Exclusão definitiva</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></div><div className="destructive-unit-summary"><span>Usuário</span><strong>{user.name}</strong></div><p className="destructive-warning"><strong>Esta operação não poderá ser desfeita.</strong> Usuários com acessos, auditorias ou autoria histórica devem permanecer arquivados.</p><div className="field-group"><label htmlFor="delete-user-password">Confirme sua senha</label><input id="delete-user-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></div><div className="field-group"><label htmlFor="delete-user-confirmation">Digite exatamente: <strong>{phrase}</strong></label><input id="delete-user-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></div><div className={`form-feedback${error ? " form-feedback-visible" : ""}`}>{error}</div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button><button className="danger-button" type="button" onClick={() => void remove()} disabled={loading || !password || confirmation !== phrase}>{loading ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}{loading ? "Verificando..." : "Excluir definitivamente"}</button></div></section></div>;
}

export function ArchivedUsersManager() {
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<OrganizationalScope | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<UserRecord>>({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [restoring, setRestoring] = useState<UserRecord | null>(null);
  const [assessing, setAssessing] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState<UserRecord | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState({ message: "", kind: "success" as "success" | "error" });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "10" });
        if (search.trim()) params.set("search", search.trim());
        if (scope) params.set("scope", scope);
        const body = await readApi<{ result: PageResult<UserRecord> }>(await fetch(`/api/platform/archived-users?${params}`, { cache: "no-store", signal: controller.signal }));
        setResult(body.result);
      } catch (error) {
        if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar os usuários arquivados.", kind: "error" });
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [search, scope, page, refresh]);

  async function restore() {
    if (!restoring || mutating) return;
    setMutating(true);
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/platform/users/${restoring.id}/restore`, { method: "POST" }));
      setToast({ message: body.message, kind: "success" }); setRestoring(null); setRefresh((value) => value + 1);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Não foi possível restaurar o usuário.", kind: "error" }); setRestoring(null);
    } finally { setMutating(false); }
  }

  return <><AdminPageHeader eyebrow="Administração do NexIgreja" title="Usuários arquivados" description="Preserve autoria e histórico, restaure acessos ou trate exclusões definitivas excepcionais." /><section className="platform-owner-banner platform-owner-banner-neutral"><UserX size={21} /><div><strong>Acesso encerrado, histórico preservado</strong><span>Usuários arquivados não podem entrar e não aparecem nas listagens organizacionais normais.</span></div></section><section className="content-card admin-list-card"><div className="filter-bar"><label className="search-field"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, usuário, e-mail ou unidade" aria-label="Pesquisar usuários arquivados" /></label><select value={scope} onChange={(event) => { setScope(event.target.value as OrganizationalScope | ""); setPage(1); }}><option value="">Todos os escopos</option><option value="CONVENCAO">Convenção</option><option value="MATRIZ">Matriz</option><option value="FILIAL">Filial</option></select></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>Usuário</th><th>Escopo</th><th>Unidade</th><th>Arquivado em</th><th>Arquivado por</th><th className="actions-column">Ações</th></tr></thead><tbody>{loading ? <LoadingRows columns={6} /> : null}{!loading && !result.items.length ? <EmptyRows columns={6} message="Nenhum usuário arquivado." /> : null}{!loading ? result.items.map((user) => <tr key={user.id}><td><div className="user-cell"><UserAvatar photoUrl={user.profilePhotoUrl} name={user.name} className="table-user-avatar" /><div><strong>{user.name}</strong><small>@{user.username} · {user.email}</small></div></div></td><td>{scopeLabels[user.scope]}</td><td>{userUnit(user)}</td><td>{user.archivedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.archivedAt)) : "—"}</td><td>{user.archivedByName ?? "Proprietário"}</td><td><div className="row-actions"><button className="action-success" type="button" onClick={() => setRestoring(user)} title="Restaurar"><RotateCcw size={17} /></button><button type="button" onClick={() => setAssessing(user)} title="Verificar exclusão"><ListChecks size={17} /></button><button className="action-danger" type="button" onClick={() => setDeleting(user)} title="Excluir definitivamente"><Trash2 size={17} /></button></div></td></tr>) : null}</tbody></table></div><Pagination page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} /></section><ConfirmDialog open={Boolean(restoring)} title="Restaurar este usuário?" description={`“${restoring?.name ?? ""}” voltará às listagens como inativo e deverá ser reativado antes de acessar.`} confirmLabel="Restaurar usuário" loading={mutating} danger={false} onCancel={() => setRestoring(null)} onConfirm={() => void restore()} /><AssessmentDialog user={assessing} onClose={() => setAssessing(null)} /><DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} onDeleted={(message) => { setDeleting(null); setToast({ message, kind: "success" }); setRefresh((value) => value + 1); }} /><Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} /></>;
}

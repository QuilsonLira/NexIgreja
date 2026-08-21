"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Edit3,
  KeyRound,
  LoaderCircle,
  LogOut,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";
import { useWorkspace } from "@/components/protected-shell";
import { UserAvatar } from "@/components/media-display";
import {
  AdminPageHeader,
  ConfirmDialog,
  EmptyRows,
  LoadingRows,
  Pagination,
  readApi,
  StatusBadge,
  Toast
} from "@/components/admin/admin-ui";
import type { AccountStatus, OrganizationalScope } from "@/lib/types";
import type { PermissionCode } from "@/lib/admin/permissions";
import type { PageResult, UserRecord } from "@/lib/admin/types";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE, passwordPolicyMessage } from "@/lib/password-policy";

const scopeLabels: Record<OrganizationalScope, string> = {
  CONVENCAO: "Convenção",
  MATRIZ: "Matriz",
  FILIAL: "Filial"
};

interface UserDialogProps {
  open: boolean;
  user: UserRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function UserDialog({ open, user, onClose, onSaved }: UserDialogProps) {
  const { admin, hasPermission, refreshSession } = useWorkspace();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [cpf, setCpf] = useState(user?.cpf ?? "");
  const [functionId, setFunctionId] = useState<number | null>(user?.functionId && admin.functionOptions.some((item) => item.id === user.functionId) ? user.functionId : admin.functionOptions[0]?.id ?? null);
  const [showNewFunction, setShowNewFunction] = useState(false);
  const [newFunctionName, setNewFunctionName] = useState("");
  const [creatingFunction, setCreatingFunction] = useState(false);
  const [scope, setScope] = useState<OrganizationalScope>(user?.scope ?? admin.allowedUserScopes[0]);
  const [matrixId, setMatrixId] = useState<number | null>(user?.boundMatrixId ?? admin.unitOptions.matrices[0]?.id ?? null);
  const [branchId, setBranchId] = useState<number | null>(user?.boundBranchId ?? admin.unitOptions.branches[0]?.id ?? null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [permissions, setPermissions] = useState<PermissionCode[]>(
    (user?.permissions ?? []).filter((permission) => admin.permissions.includes(permission))
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const delegableDefinitions = useMemo(
    () => admin.permissionDefinitions.filter((definition) => admin.permissions.includes(definition.code)),
    [admin]
  );
  const permissionGroups = useMemo(
    () => Array.from(new Set(delegableDefinitions.map((definition) => definition.group))),
    [delegableDefinitions]
  );

  if (!open) return null;

  function togglePermission(permission: PermissionCode) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function createFunction() {
    if (creatingFunction || newFunctionName.trim().length < 2) return;
    setCreatingFunction(true);
    setError("");
    try {
      const body = await readApi<{ function: { id: number; name: string } }>(await fetch("/api/admin/functions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newFunctionName }) }));
      setFunctionId(body.function.id);
      setNewFunctionName("");
      setShowNewFunction(false);
      await refreshSession();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível cadastrar a função.");
    } finally {
      setCreatingFunction(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!user) {
      const policyError = passwordPolicyMessage(temporaryPassword);
      if (policyError) {
        setError(policyError);
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const body = {
        name,
        username,
        email,
        ...(cpf.trim() ? { cpf } : {}),
        functionId,
        scope,
        matrixId: scope === "MATRIZ" ? matrixId : null,
        branchId: scope === "FILIAL" ? branchId : null,
        ...(user ? {} : { temporaryPassword }),
        permissions
      };
      const response = await fetch(user ? `/api/admin/users/${user.id}` : "/api/admin/users", {
        method: user ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await readApi<{ message: string; user: UserRecord }>(response);
      onSaved(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar o usuário.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card admin-form-dialog user-form-dialog" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div className="dialog-heading">
          <span className="dialog-icon"><UserRound size={22} /></span>
          <div>
            <p className="eyebrow">Controle de acesso</p>
            <h2 id="user-dialog-title">{user ? "Editar usuário" : "Cadastrar usuário"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className="form-section">
            <div className="form-section-heading"><strong>Identificação</strong><span>Dados usados no acesso e na exibição</span></div>
            <div className="form-grid">
              <div className="field-group form-span-2">
                <label htmlFor="user-name">Nome completo</label>
                <input id="user-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} disabled={loading} required autoFocus />
              </div>
              <div className="field-group">
                <label htmlFor="user-username">Nome de usuário</label>
                <input id="user-username" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} disabled={loading} required autoComplete="off" />
              </div>
              <div className="field-group">
                <label htmlFor="user-email">E-mail</label>
                <input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} disabled={loading} required autoComplete="off" />
              </div>
              <div className="field-group">
                <label htmlFor="user-cpf">CPF</label>
                <input id="user-cpf" value={cpf} onChange={(event) => setCpf(event.target.value)} maxLength={20} disabled={loading} required inputMode="numeric" placeholder="000.000.000-00" />
                <small>CPF, e-mail e usuário precisam ser únicos somente nesta organização.</small>
              </div>
              <div className="field-group">
                <label htmlFor="user-role">Função</label>
                <select id="user-role" value={functionId ?? ""} onChange={(event) => setFunctionId(Number(event.target.value) || null)} disabled={loading} required><option value="">Selecione a função</option>{admin.functionOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
                {hasPermission("FUNCOES_CRIAR") ? <button className="text-button" type="button" onClick={() => setShowNewFunction((current) => !current)} disabled={loading}>+ Nova função</button> : null}
              </div>
              {showNewFunction ? <div className="field-group form-span-2"><label htmlFor="new-function-name">Cadastrar função sem sair do vínculo</label><div className="inline-field-action"><input id="new-function-name" value={newFunctionName} onChange={(event) => setNewFunctionName(event.target.value)} minLength={2} maxLength={100} disabled={creatingFunction} placeholder="Nome da função" /><button className="secondary-button" type="button" onClick={() => void createFunction()} disabled={creatingFunction || newFunctionName.trim().length < 2}>{creatingFunction ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Adicionar</button></div></div> : null}
              {!user ? (
                <div className="field-group form-span-2">
                  <label htmlFor="user-password">Senha temporária</label>
                  <input id="user-password" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={PASSWORD_MIN_LENGTH} disabled={loading} required autoComplete="new-password" />
                  <small>{PASSWORD_POLICY_MESSAGE} Esta senha pertence somente a esta organização e não altera acessos do mesmo usuário em outros tenants.</small>
                </div>
              ) : null}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Escopo organizacional</strong><span>Define onde o usuário pode atuar</span></div>
            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="user-scope">Escopo</label>
                <select id="user-scope" value={scope} onChange={(event) => setScope(event.target.value as OrganizationalScope)} disabled={loading}>
                  {admin.allowedUserScopes.map((option) => <option value={option} key={option}>{scopeLabels[option]}</option>)}
                </select>
              </div>
              {scope === "MATRIZ" ? (
                <div className="field-group">
                  <label htmlFor="user-matrix">Matriz vinculada</label>
                  <select id="user-matrix" value={matrixId ?? ""} onChange={(event) => setMatrixId(Number(event.target.value) || null)} disabled={loading} required>
                    <option value="">Selecione a matriz</option>
                    {admin.unitOptions.matrices.map((matrix) => <option value={matrix.id} key={matrix.id}>{matrix.name}</option>)}
                  </select>
                </div>
              ) : null}
              {scope === "FILIAL" ? (
                <div className="field-group">
                  <label htmlFor="user-branch">Filial vinculada</label>
                  <select id="user-branch" value={branchId ?? ""} onChange={(event) => setBranchId(Number(event.target.value) || null)} disabled={loading} required>
                    <option value="">Selecione a filial</option>
                    {admin.unitOptions.branches.map((branch) => {
                      const matrix = admin.unitOptions.matrices.find((item) => item.id === branch.matrixId);
                      return <option value={branch.id} key={branch.id}>{matrix ? `${matrix.name} · ` : ""}{branch.name}</option>;
                    })}
                  </select>
                </div>
              ) : null}
              {scope === "CONVENCAO" ? (
                <div className="fixed-field"><span>Convenção vinculada</span><strong>{admin.unitOptions.convention.name}</strong></div>
              ) : null}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Permissões</strong><span>O backend confere cada ação novamente</span></div>
            <div className="permissions-grid">
              {permissionGroups.map((group) => (
                <fieldset key={group}>
                  <legend>{group}</legend>
                  {delegableDefinitions.filter((definition) => definition.group === group).map((definition) => (
                    <label className="permission-option" key={definition.code}>
                      <input type="checkbox" checked={permissions.includes(definition.code)} onChange={() => togglePermission(definition.code)} disabled={loading} />
                      <span><strong>{definition.label}</strong><small>{definition.code.replaceAll("_", " ").toLowerCase()}</small></span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </div>

          <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error}</div>
          <div className="dialog-actions sticky-dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button className="primary-button compact-button" type="submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {loading ? "Salvando..." : "Salvar usuário"}
            </button>
          </div>
        </form>
      </section>
    </div>
    </>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onSaved
}: {
  user: UserRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!user) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
      }));
      onSaved(body.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card admin-form-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title">
        <div className="dialog-heading">
          <span className="dialog-icon"><KeyRound size={22} /></span>
          <div><p className="eyebrow">Segurança</p><h2 id="reset-title">Orientar recuperação</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="security-operation-note">
          <ShieldCheck size={19} />
          <span>A senha de <strong>{user.name}</strong> pertence somente a esta organização. Esta ação encerra as sessões desse acesso e registra a orientação para que o usuário troque a própria senha.</span>
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className={`form-feedback${error ? " form-feedback-visible" : ""}`}>{error}</div>
          <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button><button className="primary-button compact-button" type="submit" disabled={loading} autoFocus>{loading ? <LoaderCircle className="spin" size={18} /> : <KeyRound size={18} />}{loading ? "Processando..." : "Encerrar sessões do vínculo"}</button></div>
        </form>
      </section>
    </div>
  );
}

type ConfirmAction = { type: "status" | "sessions" | "archive"; user: UserRecord } | null;

export function UsersManager() {
  const { session, hasPermission } = useWorkspace();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<OrganizationalScope | "">("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<UserRecord>>({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [resetting, setResetting] = useState<UserRecord | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
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
        if (status) params.set("status", status);
        const body = await readApi<{ result: PageResult<UserRecord> }>(await fetch(`/api/admin/users?${params}`, { signal: controller.signal, cache: "no-store" }));
        setResult(body.result);
      } catch (error) {
        if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar os usuários.", kind: "error" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [search, scope, status, page, refresh]);

  function saved(message: string) {
    setDialogOpen(false);
    setEditing(null);
    setResetting(null);
    setToast({ message, kind: "success" });
    setRefresh((value) => value + 1);
  }

  async function confirmMutation() {
    if (!confirmAction || mutating) return;
    setMutating(true);
    try {
      const isSessions = confirmAction.type === "sessions";
      const isArchive = confirmAction.type === "archive";
      const nextStatus = confirmAction.user.status === "ATIVO" ? "INATIVO" : "ATIVO";
      const response = await fetch(
        isArchive ? `/api/platform/users/${confirmAction.user.id}/archive` : isSessions ? `/api/admin/users/${confirmAction.user.id}/sessions` : `/api/admin/users/${confirmAction.user.id}/status`,
        isArchive
          ? { method: "POST" }
          : isSessions
          ? { method: "DELETE" }
          : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }
      );
      const body = await readApi<{ message: string }>(response);
      setToast({ message: body.message, kind: "success" });
      setConfirmAction(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Não foi possível concluir a operação.", kind: "error" });
      setConfirmAction(null);
    } finally {
      setMutating(false);
    }
  }

  const canCreate = hasPermission("USUARIOS_CRIAR");
  const canEdit = hasPermission("USUARIOS_EDITAR");
  const canStatus = hasPermission("USUARIOS_DESATIVAR");
  const canSecurity = hasPermission("USUARIOS_REDEFINIR_SENHA");

  return (
    <>
      <AdminPageHeader eyebrow="Acessos e permissões" title="Vínculos organizacionais" description="Associe identidades globais à organização e defina função, escopo, status e permissões independentes." action={canCreate ? <button className="primary-button compact-button" type="button" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={19} /> Novo vínculo</button> : undefined} />
      <section className="content-card admin-list-card">
        <div className="filter-bar">
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar nome, usuário, e-mail ou função" aria-label="Pesquisar usuários" /></label>
          <select value={scope} onChange={(event) => { setScope(event.target.value as OrganizationalScope | ""); setPage(1); }} aria-label="Filtrar por escopo"><option value="">Todos os escopos</option><option value="CONVENCAO">Convenção</option><option value="MATRIZ">Matriz</option><option value="FILIAL">Filial</option></select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as AccountStatus | ""); setPage(1); }} aria-label="Filtrar por status"><option value="">Todos os status</option><option value="ATIVO">Ativos</option><option value="PENDENTE">Convites pendentes</option><option value="INATIVO">Inativos</option><option value="BLOQUEADO">Bloqueados</option></select>
        </div>
        <div className="table-wrap">
          <table className="admin-table users-table">
            <thead><tr><th>Usuário</th><th>Escopo e unidade</th><th>Função</th><th>Sessões</th><th>Status</th><th className="actions-column">Ações</th></tr></thead>
            <tbody>
              {loading ? <LoadingRows columns={6} /> : null}
              {!loading && !result.items.length ? <EmptyRows columns={6} message="Nenhum usuário encontrado com esses filtros." /> : null}
              {!loading ? result.items.map((user) => {
                const isSelf = user.id === session.user.membershipId;
                const unitName = user.scope === "CONVENCAO" ? "Toda a convenção" : user.scope === "MATRIZ" ? user.matrixName : user.branchName;
                return (
                  <tr key={user.id}>
                    <td><div className="user-cell"><UserAvatar photoUrl={user.profilePhotoUrl} name={user.name} className="table-user-avatar" /><div><strong>{user.name}{isSelf ? " (você)" : ""}</strong><small>@{user.username} · {user.email}</small></div></div></td>
                    <td><strong className="table-primary-text">{scopeLabels[user.scope]}</strong><small>{unitName ?? "Vínculo indisponível"}</small></td>
                    <td>{user.roleName}</td>
                    <td><span className="session-count">{user.activeSessions}</span></td>
                    <td><StatusBadge status={user.status} /></td>
                    <td><div className="row-actions">
                      {canEdit && !isSelf ? <button type="button" onClick={() => { setEditing(user); setDialogOpen(true); }} title="Editar" aria-label={`Editar ${user.name}`}><Edit3 size={17} /></button> : null}
                      {canSecurity && !isSelf && user.status !== "PENDENTE" ? <button type="button" onClick={() => setResetting(user)} title="Orientar recuperação de senha" aria-label={`Orientar recuperação de senha de ${user.name}`}><KeyRound size={17} /></button> : null}
                      {canSecurity && !isSelf ? <button type="button" onClick={() => setConfirmAction({ type: "sessions", user })} title="Encerrar sessões" aria-label={`Encerrar sessões de ${user.name}`}><LogOut size={17} /></button> : null}
                      {canStatus && !isSelf && user.status !== "PENDENTE" ? <button className={user.status === "ATIVO" ? "action-danger" : "action-success"} type="button" onClick={() => setConfirmAction({ type: "status", user })} title={user.status === "ATIVO" ? "Desativar" : "Ativar"} aria-label={`${user.status === "ATIVO" ? "Desativar" : "Ativar"} ${user.name}`}>{user.status === "ATIVO" ? <PowerOff size={17} /> : <Power size={17} />}</button> : null}
                      {session.user.isPlatformOwner && !isSelf && user.status === "INATIVO" ? <button className="action-danger" type="button" onClick={() => setConfirmAction({ type: "archive", user })} title="Arquivar usuário" aria-label={`Arquivar ${user.name}`}><Archive size={17} /></button> : null}
                      {isSelf ? <span className="no-actions">Conta atual</span> : null}
                    </div></td>
                  </tr>
                );
              }) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
      </section>

      {dialogOpen ? (
        <UserDialog key={editing ? `edit-user-${editing.id}` : "new-user"} open user={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} onSaved={saved} />
      ) : null}
      {resetting ? (
        <ResetPasswordDialog key={`reset-${resetting.id}`} user={resetting} onClose={() => setResetting(null)} onSaved={saved} />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === "archive" ? "Arquivar este usuário?" : confirmAction?.type === "sessions" ? "Encerrar todas as sessões?" : confirmAction?.user.status === "ATIVO" ? "Desativar este usuário?" : "Ativar este usuário?"}
        description={confirmAction?.type === "archive"
          ? `${confirmAction.user.name} sairá das listagens normais, não poderá entrar e continuará preservado no histórico.`
          : confirmAction?.type === "sessions"
          ? `${confirmAction.user.name} precisará entrar novamente em todos os dispositivos.`
          : confirmAction?.user.status === "ATIVO"
            ? `${confirmAction?.user.name ?? "O usuário"} perderá imediatamente o acesso e suas sessões serão encerradas.`
            : `${confirmAction?.user.name ?? "O usuário"} poderá entrar novamente, desde que sua unidade esteja ativa.`}
        confirmLabel={confirmAction?.type === "archive" ? "Arquivar usuário" : confirmAction?.type === "sessions" ? "Encerrar sessões" : confirmAction?.user.status === "ATIVO" ? "Desativar usuário" : "Ativar usuário"}
        loading={mutating}
        danger={confirmAction?.type === "archive" || confirmAction?.type === "sessions" || confirmAction?.user.status === "ATIVO"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void confirmMutation()}
      />
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
import type { AccountStatus, OrganizationalScope } from "@/lib/auth/types";
import type { PermissionCode } from "@/lib/admin/permissions";
import type { PageResult, UserRecord } from "@/lib/admin/types";

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
  const { admin } = useWorkspace();
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [cpf, setCpf] = useState("");
  const [roleName, setRoleName] = useState(user?.roleName ?? "");
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const body = {
        name,
        username,
        email,
        ...(cpf.trim() ? { cpf } : {}),
        roleName,
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
      const result = await readApi<{ message: string }>(response);
      onSaved(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar o usuário.");
    } finally {
      setLoading(false);
    }
  }

  return (
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
                <label htmlFor="user-cpf">{user ? "Novo CPF (opcional)" : "CPF"}</label>
                <input id="user-cpf" value={cpf} onChange={(event) => setCpf(event.target.value)} maxLength={20} disabled={loading} required={!user} inputMode="numeric" placeholder={user?.cpfHint ?? "000.000.000-00"} />
                {user ? <small>Atual: {user.cpfHint}. Deixe vazio para manter.</small> : null}
              </div>
              <div className="field-group">
                <label htmlFor="user-role">Função</label>
                <input id="user-role" value={roleName} onChange={(event) => setRoleName(event.target.value)} maxLength={100} disabled={loading} required placeholder="Ex.: Administrador" />
              </div>
              {!user ? (
                <div className="field-group form-span-2">
                  <label htmlFor="user-password">Senha temporária</label>
                  <input id="user-password" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} maxLength={128} disabled={loading} required autoComplete="new-password" />
                  <small>Mínimo de 12 caracteres, com letras e números. A troca será obrigatória no primeiro acesso.</small>
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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!user) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword: password, confirmPassword: confirm })
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
          <div><p className="eyebrow">Segurança</p><h2 id="reset-title">Redefinir senha</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="security-operation-note">
          <ShieldCheck size={19} />
          <span><strong>{user.name}</strong> será desconectado de todas as sessões e deverá trocar a senha no próximo acesso.</span>
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className="field-group"><label htmlFor="reset-password">Nova senha temporária</label><input id="reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required autoFocus disabled={loading} /><small>Mínimo de 12 caracteres, com letras e números.</small></div>
          <div className="field-group"><label htmlFor="reset-confirm">Confirmar senha</label><input id="reset-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required disabled={loading} /></div>
          <div className={`form-feedback${error ? " form-feedback-visible" : ""}`}>{error}</div>
          <div className="dialog-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button><button className="primary-button compact-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={18} /> : <KeyRound size={18} />}{loading ? "Redefinindo..." : "Redefinir senha"}</button></div>
        </form>
      </section>
    </div>
  );
}

type ConfirmAction = { type: "status" | "sessions"; user: UserRecord } | null;

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
      const nextStatus = confirmAction.user.status === "ATIVO" ? "INATIVO" : "ATIVO";
      const response = await fetch(
        isSessions ? `/api/admin/users/${confirmAction.user.id}/sessions` : `/api/admin/users/${confirmAction.user.id}/status`,
        isSessions
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
      <AdminPageHeader eyebrow="Acessos e permissões" title="Usuários" description="Cadastre usuários, defina seu alcance e libere somente as ações necessárias." action={canCreate ? <button className="primary-button compact-button" type="button" onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus size={19} /> Novo usuário</button> : undefined} />
      <section className="content-card admin-list-card">
        <div className="filter-bar">
          <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar nome, usuário, e-mail ou função" aria-label="Pesquisar usuários" /></label>
          <select value={scope} onChange={(event) => { setScope(event.target.value as OrganizationalScope | ""); setPage(1); }} aria-label="Filtrar por escopo"><option value="">Todos os escopos</option><option value="CONVENCAO">Convenção</option><option value="MATRIZ">Matriz</option><option value="FILIAL">Filial</option></select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as AccountStatus | ""); setPage(1); }} aria-label="Filtrar por status"><option value="">Todos os status</option><option value="ATIVO">Ativos</option><option value="INATIVO">Inativos</option><option value="BLOQUEADO">Bloqueados</option><option value="EX_USUARIO">Ex-usuários</option></select>
        </div>
        <div className="table-wrap">
          <table className="admin-table users-table">
            <thead><tr><th>Usuário</th><th>Escopo e unidade</th><th>Função</th><th>Sessões</th><th>Status</th><th className="actions-column">Ações</th></tr></thead>
            <tbody>
              {loading ? <LoadingRows columns={6} /> : null}
              {!loading && !result.items.length ? <EmptyRows columns={6} message="Nenhum usuário encontrado com esses filtros." /> : null}
              {!loading ? result.items.map((user) => {
                const isSelf = user.id === session.user.id;
                const unitName = user.scope === "CONVENCAO" ? "Toda a convenção" : user.scope === "MATRIZ" ? user.matrixName : user.branchName;
                return (
                  <tr key={user.id}>
                    <td><div className="user-cell"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}{isSelf ? " (você)" : ""}</strong><small>@{user.username} · {user.email}</small></div></div></td>
                    <td><strong className="table-primary-text">{scopeLabels[user.scope]}</strong><small>{unitName ?? "Vínculo indisponível"}</small></td>
                    <td>{user.roleName}</td>
                    <td><span className="session-count">{user.activeSessions}</span></td>
                    <td><StatusBadge status={user.status} /></td>
                    <td><div className="row-actions">
                      {canEdit && !isSelf ? <button type="button" onClick={() => { setEditing(user); setDialogOpen(true); }} title="Editar" aria-label={`Editar ${user.name}`}><Edit3 size={17} /></button> : null}
                      {canSecurity && !isSelf ? <button type="button" onClick={() => setResetting(user)} title="Redefinir senha" aria-label={`Redefinir senha de ${user.name}`}><KeyRound size={17} /></button> : null}
                      {canSecurity && !isSelf ? <button type="button" onClick={() => setConfirmAction({ type: "sessions", user })} title="Encerrar sessões" aria-label={`Encerrar sessões de ${user.name}`}><LogOut size={17} /></button> : null}
                      {canStatus && !isSelf ? <button className={user.status === "ATIVO" ? "action-danger" : "action-success"} type="button" onClick={() => setConfirmAction({ type: "status", user })} title={user.status === "ATIVO" ? "Desativar" : "Ativar"} aria-label={`${user.status === "ATIVO" ? "Desativar" : "Ativar"} ${user.name}`}>{user.status === "ATIVO" ? <PowerOff size={17} /> : <Power size={17} />}</button> : null}
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
        title={confirmAction?.type === "sessions" ? "Encerrar todas as sessões?" : confirmAction?.user.status === "ATIVO" ? "Desativar este usuário?" : "Ativar este usuário?"}
        description={confirmAction?.type === "sessions"
          ? `${confirmAction.user.name} precisará entrar novamente em todos os dispositivos.`
          : confirmAction?.user.status === "ATIVO"
            ? `${confirmAction?.user.name ?? "O usuário"} perderá imediatamente o acesso e suas sessões serão encerradas.`
            : `${confirmAction?.user.name ?? "O usuário"} poderá entrar novamente, desde que sua unidade esteja ativa.`}
        confirmLabel={confirmAction?.type === "sessions" ? "Encerrar sessões" : confirmAction?.user.status === "ATIVO" ? "Desativar usuário" : "Ativar usuário"}
        loading={mutating}
        danger={confirmAction?.type === "sessions" || confirmAction?.user.status === "ATIVO"}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void confirmMutation()}
      />
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

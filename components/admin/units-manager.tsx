"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Edit3,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  Search,
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
import type { AdminUnitStatus, AdminUnitType, PageResult, UnitRecord } from "@/lib/admin/types";

const typeLabels: Record<AdminUnitType, string> = {
  CONVENCAO: "Convenção",
  MATRIZ: "Matriz",
  FILIAL: "Filial"
};

interface UnitDialogProps {
  open: boolean;
  unit: UnitRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function UnitDialog({ open, unit, onClose, onSaved }: UnitDialogProps) {
  const { admin } = useWorkspace();
  const [type, setType] = useState<AdminUnitType>(unit?.type ?? admin.creatableUnitTypes[0] ?? "FILIAL");
  const [name, setName] = useState(unit?.name ?? "");
  const [matrixId, setMatrixId] = useState<number | null>(unit?.matrixId ?? admin.unitOptions.matrices[0]?.id ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        unit ? `/api/admin/units/${unit.type.toLowerCase()}/${unit.id}` : "/api/admin/units",
        {
          method: unit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(unit ? {} : { type }), name, matrixId: type === "FILIAL" ? matrixId : null })
        }
      );
      const body = await readApi<{ message: string }>(response);
      onSaved(body.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar a unidade.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card admin-form-dialog" role="dialog" aria-modal="true" aria-labelledby="unit-dialog-title">
        <div className="dialog-heading">
          <span className="dialog-icon"><Building2 size={22} /></span>
          <div>
            <p className="eyebrow">Unidades organizacionais</p>
            <h2 id="unit-dialog-title">{unit ? "Editar unidade" : "Cadastrar unidade"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="field-group">
              <label htmlFor="unit-type">Tipo</label>
              <select id="unit-type" value={type} onChange={(event) => setType(event.target.value as AdminUnitType)} disabled={Boolean(unit) || loading}>
                {(unit ? [unit.type] : admin.creatableUnitTypes).map((option) => (
                  <option value={option} key={option}>{typeLabels[option]}</option>
                ))}
              </select>
            </div>
            <div className="field-group form-span-2">
              <label htmlFor="unit-name">Nome da unidade</label>
              <input id="unit-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={150} disabled={loading} autoFocus required />
            </div>
            {type === "FILIAL" ? (
              <div className="field-group form-span-2">
                <label htmlFor="unit-matrix">Matriz responsável</label>
                <select id="unit-matrix" value={matrixId ?? ""} onChange={(event) => setMatrixId(Number(event.target.value) || null)} disabled={loading} required>
                  <option value="">Selecione a matriz</option>
                  {admin.unitOptions.matrices.map((matrix) => (
                    <option value={matrix.id} key={matrix.id}>{matrix.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error}</div>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button className="primary-button compact-button" type="submit" disabled={loading || !name.trim()}>
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {loading ? "Salvando..." : "Salvar unidade"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function UnitsManager() {
  const { admin, hasPermission } = useWorkspace();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<AdminUnitType | "">("");
  const [status, setStatus] = useState<AdminUnitStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult<UnitRecord>>({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UnitRecord | null>(null);
  const [confirming, setConfirming] = useState<UnitRecord | null>(null);
  const [mutating, setMutating] = useState(false);
  const [toast, setToast] = useState({ message: "", kind: "success" as "success" | "error" });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: "10" });
        if (search.trim()) params.set("search", search.trim());
        if (type) params.set("type", type);
        if (status) params.set("status", status);
        const body = await readApi<{ result: PageResult<UnitRecord> }>(
          await fetch(`/api/admin/units?${params}`, { signal: controller.signal, cache: "no-store" })
        );
        setResult(body.result);
      } catch (error) {
        if (!controller.signal.aborted) setToast({ message: error instanceof Error ? error.message : "Não foi possível carregar as unidades.", kind: "error" });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search, type, status, page, refresh]);

  function saved(message: string) {
    setDialogOpen(false);
    setEditing(null);
    setToast({ message, kind: "success" });
    setRefresh((value) => value + 1);
  }

  async function changeStatus() {
    if (!confirming || mutating) return;
    setMutating(true);
    const nextStatus = confirming.status === "ATIVO" ? "INATIVO" : "ATIVO";
    try {
      const body = await readApi<{ message: string }>(
        await fetch(`/api/admin/units/${confirming.type.toLowerCase()}/${confirming.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus })
        })
      );
      setConfirming(null);
      setToast({ message: body.message, kind: "success" });
      setRefresh((value) => value + 1);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Não foi possível alterar a unidade.", kind: "error" });
      setConfirming(null);
    } finally {
      setMutating(false);
    }
  }

  const canCreate = hasPermission("UNIDADES_CRIAR") && admin.creatableUnitTypes.length > 0;
  const canEdit = hasPermission("UNIDADES_EDITAR");

  return (
    <>
      <AdminPageHeader
        eyebrow="Estrutura organizacional"
        title="Unidades"
        description="Gerencie somente a convenção, as matrizes e as filiais alcançadas pela sua conta."
        action={canCreate ? (
          <button className="primary-button compact-button" type="button" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus size={19} /> Nova unidade
          </button>
        ) : undefined}
      />

      <section className="content-card admin-list-card">
        <div className="filter-bar">
          <label className="search-field">
            <Search size={18} />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar unidade ou vínculo" aria-label="Pesquisar unidades" />
          </label>
          <select value={type} onChange={(event) => { setType(event.target.value as AdminUnitType | ""); setPage(1); }} aria-label="Filtrar por tipo">
            <option value="">Todos os tipos</option>
            <option value="CONVENCAO">Convenção</option>
            <option value="MATRIZ">Matriz</option>
            <option value="FILIAL">Filial</option>
          </select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as AdminUnitStatus | ""); setPage(1); }} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativas</option>
            <option value="INATIVO">Inativas</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Unidade</th><th>Tipo</th><th>Vínculo superior</th><th>Status</th><th className="actions-column">Ações</th></tr></thead>
            <tbody>
              {loading ? <LoadingRows columns={5} /> : null}
              {!loading && !result.items.length ? <EmptyRows columns={5} message="Nenhuma unidade encontrada com esses filtros." /> : null}
              {!loading ? result.items.map((unit) => (
                <tr key={`${unit.type}-${unit.id}`}>
                  <td><strong>{unit.name}</strong><small>{unit.conventionName}</small></td>
                  <td><span className={`unit-type unit-type-${unit.type.toLowerCase()}`}>{typeLabels[unit.type]}</span></td>
                  <td>{unit.parentName ?? "—"}</td>
                  <td><StatusBadge status={unit.status} /></td>
                  <td>
                    <div className="row-actions">
                      {canEdit ? (
                        <button type="button" onClick={() => { setEditing(unit); setDialogOpen(true); }} aria-label={`Editar ${unit.name}`} title="Editar">
                          <Edit3 size={17} />
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button className={unit.status === "ATIVO" ? "action-danger" : "action-success"} type="button" onClick={() => setConfirming(unit)} aria-label={`${unit.status === "ATIVO" ? "Desativar" : "Ativar"} ${unit.name}`} title={unit.status === "ATIVO" ? "Desativar" : "Ativar"}>
                          {unit.status === "ATIVO" ? <PowerOff size={17} /> : <Power size={17} />}
                        </button>
                      ) : null}
                      {!canEdit ? <span className="no-actions">Somente leitura</span> : null}
                    </div>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} onPage={setPage} />
      </section>

      {dialogOpen ? (
        <UnitDialog key={editing ? `edit-${editing.type}-${editing.id}` : "new-unit"} open unit={editing} onClose={() => { setDialogOpen(false); setEditing(null); }} onSaved={saved} />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.status === "ATIVO" ? "Desativar esta unidade?" : "Ativar esta unidade?"}
        description={confirming?.status === "ATIVO"
          ? `O acesso à unidade “${confirming?.name ?? ""}” será interrompido. Unidades subordinadas não serão apagadas.`
          : `A unidade “${confirming?.name ?? ""}” voltará a ficar disponível, desde que seu vínculo superior esteja ativo.`}
        confirmLabel={confirming?.status === "ATIVO" ? "Desativar unidade" : "Ativar unidade"}
        loading={mutating}
        danger={confirming?.status === "ATIVO"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void changeStatus()}
      />
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Building2,
  Edit3,
  ImagePlus,
  LoaderCircle,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
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
import { frontendImageError, IMAGE_MAX_LABEL, IMAGE_TYPE_MESSAGE } from "@/lib/image-policy";

const typeLabels: Record<AdminUnitType, string> = {
  CONVENCAO: "Convenção",
  MATRIZ: "Matriz",
  FILIAL: "Filial"
};

function formatCnpj(value: string | null): string {
  if (!value || value.length !== 14) return "—";
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

interface UnitDialogProps {
  open: boolean;
  unit: UnitRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

type UnitFormValues = {
  name: string;
  legalName: string;
  fantasyName: string;
  cnpj: string;
  responsibleName: string;
  phone: string;
  whatsapp: string;
  email: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  foundationDate: string;
  notes: string;
};

function unitFormValues(unit: UnitRecord | null): UnitFormValues {
  return {
    name: unit?.name ?? "",
    legalName: unit?.legalName ?? "",
    fantasyName: unit?.fantasyName ?? "",
    cnpj: unit?.ownCnpj ?? "",
    responsibleName: unit?.responsibleName ?? "",
    phone: unit?.phone ?? "",
    whatsapp: unit?.whatsapp ?? "",
    email: unit?.email ?? "",
    postalCode: unit?.postalCode ?? "",
    street: unit?.street ?? "",
    number: unit?.number ?? "",
    complement: unit?.complement ?? "",
    district: unit?.district ?? "",
    city: unit?.city ?? "",
    state: unit?.state ?? "",
    foundationDate: unit?.foundationDate ?? "",
    notes: unit?.notes ?? "",
  };
}

function UnitDialog({ open, unit, onClose, onSaved }: UnitDialogProps) {
  const { admin, refreshSession } = useWorkspace();
  const [type, setType] = useState<AdminUnitType>(unit?.type ?? admin.creatableUnitTypes[0] ?? "FILIAL");
  const [matrixId, setMatrixId] = useState<number | null>(unit?.matrixId ?? admin.unitOptions.matrices[0]?.id ?? null);
  const [usesParentCnpj, setUsesParentCnpj] = useState(Boolean(unit?.usesParentCnpj));
  const [values, setValues] = useState<UnitFormValues>(() => unitFormValues(unit));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(unit?.logoUrl ?? null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const selectedMatrix = admin.unitOptions.matrices.find((matrix) => matrix.id === matrixId) ?? null;

  useEffect(() => () => {
    if (logoFile && logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
  }, [logoFile, logoPreviewUrl]);

  if (!open) return null;

  function setField(field: keyof UnitFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    const imageError = frontendImageError(file);
    if (imageError) {
      setError(imageError);
      return;
    }
    if (logoFile && logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setRemoveLogo(false);
    setError("");
  }

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
          body: JSON.stringify({ ...(unit ? {} : { type }), ...values, matrixId: type === "FILIAL" ? matrixId : null, usesParentCnpj: type === "FILIAL" && usesParentCnpj })
        }
      );
      const body = await readApi<{ message: string; unit: UnitRecord }>(response);
      const savedUnit = body.unit;
      if (logoFile) {
        await readApi(await fetch(`/api/admin/units/${savedUnit.type.toLowerCase()}/${savedUnit.id}/logo`, {
          method: "PUT",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        }));
      } else if (removeLogo && unit?.logoUrl) {
        await readApi(await fetch(`/api/admin/units/${savedUnit.type.toLowerCase()}/${savedUnit.id}/logo`, { method: "DELETE" }));
      }
      if (logoFile || removeLogo) await refreshSession();
      onSaved(body.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar a unidade.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-card admin-form-dialog unit-form-dialog" role="dialog" aria-modal="true" aria-labelledby="unit-dialog-title">
        <div className="dialog-heading">
          <span className="dialog-icon"><Building2 size={22} /></span>
          <div>
            <p className="eyebrow">Unidades organizacionais</p>
            <h2 id="unit-dialog-title">{unit ? "Editar unidade" : "Cadastrar unidade"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        <form className="admin-form" onSubmit={submit}>
          <div className="form-section">
            <div className="form-section-heading"><strong>Dados da unidade</strong><span>Identificação institucional</span></div>
            <div className="form-grid">
              <div className="field-group"><label htmlFor="unit-type">Tipo</label><select id="unit-type" value={type} onChange={(event) => { const nextType = event.target.value as AdminUnitType; setType(nextType); if (nextType !== "FILIAL") setUsesParentCnpj(false); }} disabled={Boolean(unit) || loading}>{(unit ? [unit.type] : admin.creatableUnitTypes).map((option) => <option value={option} key={option}>{typeLabels[option]}</option>)}</select></div>
              <div className="field-group form-span-2"><label htmlFor="unit-name">Nome da unidade</label><input id="unit-name" value={values.name} onChange={(event) => setField("name", event.target.value)} maxLength={150} disabled={loading} autoFocus required /></div>
              <div className="field-group"><label htmlFor="unit-legal-name">Razão social</label><input id="unit-legal-name" value={values.legalName} onChange={(event) => setField("legalName", event.target.value)} maxLength={180} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-fantasy-name">Nome fantasia</label><input id="unit-fantasy-name" value={values.fantasyName} onChange={(event) => setField("fantasyName", event.target.value)} maxLength={150} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-cnpj">CNPJ</label><input id="unit-cnpj" value={usesParentCnpj ? formatCnpj(selectedMatrix?.cnpj ?? null) : formatCnpjInput(values.cnpj)} onChange={(event) => setField("cnpj", formatCnpjInput(event.target.value))} maxLength={18} inputMode="numeric" placeholder="00.000.000/0000-00" disabled={loading || usesParentCnpj} />{usesParentCnpj ? <small>O CNPJ acompanha automaticamente a Matriz selecionada.</small> : null}</div>
              <div className="field-group"><label htmlFor="unit-responsible">Responsável / pastor</label><input id="unit-responsible" value={values.responsibleName} onChange={(event) => setField("responsibleName", event.target.value)} maxLength={150} disabled={loading} /></div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Identidade visual</strong><span>Logo exibida no login e no painel</span></div>
            <div className="image-editor image-editor-logo">
              <div className="image-editor-preview logo-preview">
                {logoPreviewUrl ? <img src={logoPreviewUrl} alt="Pré-visualização da logo" /> : <Building2 size={34} aria-hidden="true" />}
              </div>
              <div className="image-editor-content">
                <strong>{logoPreviewUrl ? "Logo da unidade" : "Nenhuma logo cadastrada"}</strong>
                <small>{IMAGE_TYPE_MESSAGE} Tamanho máximo: {IMAGE_MAX_LABEL}.</small>
                <div className="image-editor-actions">
                  <button className="secondary-button" type="button" onClick={() => logoInputRef.current?.click()} disabled={loading}><ImagePlus size={18} /> {logoPreviewUrl ? "Alterar logo" : "Adicionar logo"}</button>
                  {logoPreviewUrl ? <button className="danger-outline-button" type="button" onClick={() => { if (logoFile && logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl); setLogoFile(null); setLogoPreviewUrl(null); setRemoveLogo(Boolean(unit?.logoUrl)); }} disabled={loading}><Trash2 size={18} /> Remover logo</button> : null}
                </div>
              </div>
              <input ref={logoInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseLogo(event.target.files?.[0])} />
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Contato</strong><span>Canais oficiais da unidade</span></div>
            <div className="form-grid">
              <div className="field-group"><label htmlFor="unit-phone">Telefone</label><input id="unit-phone" value={values.phone} onChange={(event) => setField("phone", event.target.value)} maxLength={20} inputMode="tel" disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-whatsapp">WhatsApp</label><input id="unit-whatsapp" value={values.whatsapp} onChange={(event) => setField("whatsapp", event.target.value)} maxLength={20} inputMode="tel" disabled={loading} /></div>
              <div className="field-group form-span-2"><label htmlFor="unit-email">E-mail</label><input id="unit-email" type="email" value={values.email} onChange={(event) => setField("email", event.target.value)} maxLength={254} disabled={loading} /></div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Endereço</strong><span>Localização da unidade</span></div>
            <div className="form-grid">
              <div className="field-group"><label htmlFor="unit-postal-code">CEP</label><input id="unit-postal-code" value={values.postalCode} onChange={(event) => setField("postalCode", event.target.value)} maxLength={9} inputMode="numeric" disabled={loading} /></div>
              <div className="field-group form-span-2"><label htmlFor="unit-street">Logradouro</label><input id="unit-street" value={values.street} onChange={(event) => setField("street", event.target.value)} maxLength={180} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-number">Número</label><input id="unit-number" value={values.number} onChange={(event) => setField("number", event.target.value)} maxLength={30} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-complement">Complemento</label><input id="unit-complement" value={values.complement} onChange={(event) => setField("complement", event.target.value)} maxLength={120} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-district">Bairro</label><input id="unit-district" value={values.district} onChange={(event) => setField("district", event.target.value)} maxLength={120} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-city">Cidade</label><input id="unit-city" value={values.city} onChange={(event) => setField("city", event.target.value)} maxLength={120} disabled={loading} /></div>
              <div className="field-group"><label htmlFor="unit-state">UF</label><input id="unit-state" value={values.state} onChange={(event) => setField("state", event.target.value.toUpperCase())} maxLength={2} disabled={loading} /></div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Outras informações</strong><span>Dados complementares opcionais</span></div>
            <div className="form-grid">
              <div className="field-group"><label htmlFor="unit-foundation">Data de fundação</label><input id="unit-foundation" type="date" value={values.foundationDate} onChange={(event) => setField("foundationDate", event.target.value)} disabled={loading} /></div>
              <div className="field-group form-span-2"><label htmlFor="unit-notes">Observações</label><textarea id="unit-notes" value={values.notes} onChange={(event) => setField("notes", event.target.value)} maxLength={1000} rows={3} disabled={loading} /></div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-heading"><strong>Vínculo organizacional</strong><span>Respeita o escopo permitido para sua conta</span></div>
            <div className="form-grid">
              <div className="fixed-field"><span>Convenção</span><strong>{admin.unitOptions.convention.name}</strong></div>
              {type === "FILIAL" ? <div className="field-group"><label htmlFor="unit-matrix">Matriz responsável</label><select id="unit-matrix" value={matrixId ?? ""} onChange={(event) => { const nextId = Number(event.target.value) || null; setMatrixId(nextId); if (!admin.unitOptions.matrices.find((matrix) => matrix.id === nextId)?.cnpj) setUsesParentCnpj(false); }} disabled={loading} required><option value="">Selecione a matriz</option>{admin.unitOptions.matrices.map((matrix) => <option value={matrix.id} key={matrix.id}>{matrix.name}</option>)}</select></div> : null}
              {type === "FILIAL" ? <label className="permission-option form-span-2"><input type="checkbox" checked={usesParentCnpj} onChange={(event) => setUsesParentCnpj(event.target.checked)} disabled={loading || !selectedMatrix?.cnpj} /><span><strong>Usar o mesmo CNPJ da Matriz</strong><small>{selectedMatrix?.cnpj ? `CNPJ da Matriz: ${formatCnpj(selectedMatrix.cnpj)}` : "A Matriz selecionada ainda não possui CNPJ. Cadastre-o primeiro para habilitar esta opção."}</small></span></label> : null}
            </div>
          </div>
          <div className={`form-feedback${error ? " form-feedback-visible" : ""}`} role="status">{error}</div>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button className="primary-button compact-button" type="submit" disabled={loading || !values.name.trim()}>
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
  const { admin, session, hasPermission, refreshSession } = useWorkspace();
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
  const [archiving, setArchiving] = useState<UnitRecord | null>(null);
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
      await refreshSession();
      setRefresh((value) => value + 1);
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Não foi possível alterar a unidade.", kind: "error" });
      setConfirming(null);
    } finally {
      setMutating(false);
    }
  }

  async function archiveUnit() {
    if (!archiving || mutating || !session.user.isPlatformOwner) return;
    setMutating(true);
    try {
      const body = await readApi<{ message: string }>(await fetch(`/api/platform/units/${archiving.type.toLowerCase()}/${archiving.id}/archive`, { method: "POST" }));
      setToast({ message: body.message, kind: "success" });
      setArchiving(null);
      setRefresh((value) => value + 1);
      await refreshSession();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Não foi possível arquivar a unidade.", kind: "error" });
      setArchiving(null);
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
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome, CNPJ, cidade ou responsável" aria-label="Pesquisar unidades" />
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
            <thead><tr><th>Unidade</th><th>Tipo</th><th>Vínculo</th><th>Cidade / UF</th><th>CNPJ</th><th>Responsável</th><th>Status</th><th className="actions-column">Ações</th></tr></thead>
            <tbody>
              {loading ? <LoadingRows columns={8} /> : null}
              {!loading && !result.items.length ? <EmptyRows columns={8} message="Nenhuma unidade encontrada com esses filtros." /> : null}
              {!loading ? result.items.map((unit) => (
                <tr key={`${unit.type}-${unit.id}`}>
                  <td><strong>{unit.name}</strong><small>{unit.fantasyName ?? unit.legalName ?? unit.conventionName}</small></td>
                  <td><span className={`unit-type unit-type-${unit.type.toLowerCase()}`}>{typeLabels[unit.type]}</span></td>
                  <td>{unit.parentName ?? "—"}</td>
                  <td>{unit.city ? `${unit.city}${unit.state ? ` / ${unit.state}` : ""}` : "—"}</td>
                  <td>{formatCnpj(unit.cnpj)}</td>
                  <td>{unit.responsibleName ?? "—"}</td>
                  <td><StatusBadge status={unit.status} /></td>
                  <td>
                    <div className="row-actions">
                      {canEdit ? (
                        <button type="button" onClick={() => { setEditing(unit); setDialogOpen(true); }} aria-label={`Editar ${unit.name}`} title="Editar">
                          <Edit3 size={17} />
                        </button>
                      ) : null}
                      {session.user.isPlatformOwner && unit.status === "INATIVO" ? (
                        <button className="action-danger" type="button" onClick={() => setArchiving(unit)} aria-label={`Arquivar ${unit.name}`} title="Arquivar">
                          <Archive size={17} />
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
      <ConfirmDialog
        open={Boolean(archiving)}
        title="Arquivar esta unidade?"
        description={`“${archiving?.name ?? ""}” deixará de aparecer na operação normal, sem perder usuários, históricos ou registros relacionados.`}
        confirmLabel="Arquivar unidade"
        loading={mutating}
        onCancel={() => setArchiving(null)}
        onConfirm={() => void archiveUnit()}
      />
      <Toast message={toast.message} kind={toast.kind} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookCopy,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AdminPageHeader,
  readApi,
  StatusBadge,
  Toast,
} from "@/components/admin/admin-ui";
import { useWorkspace } from "@/components/protected-shell";

type Row = Record<string, unknown>;
type Data = {
  dashboard: Row;
  requests: Row[];
  movements: Row[];
  baptisms: Row[];
  baptismCandidates: Row[];
  consecrations: Row[];
  templates: Row[];
  documents: Row[];
};
type Options = { people: Row[]; units: Row[]; functions: Row[] };
type TransferSetup={candidates:Row[];destination:{id:number;name:string;type:string};destinationLocked:boolean;destinations:Row[];receiveDestinations:Row[]};
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${String(value).slice(0, 10)}T12:00:00Z`),
      )
    : "—";
const label = (value: unknown) => String(value ?? "").replaceAll("_", " ");
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="dialog-backdrop">
      <section
        className={`dialog-card secretary-dialog${wide ? " secretary-dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="secretary-dialog-header">
          <div>
            <p className="eyebrow">Secretaria Eclesiástica</p>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Field({
  name,
  children,
  wide = false,
}: {
  name: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field-group${wide ? " form-span-2" : ""}`}>
      <span>{name}</span>
      {children}
    </label>
  );
}
function PersonSearch({
  options,
  value,
  onChange,
  onSearch,
}: {
  options: Row[];
  value: string;
  onChange: (v: string) => void;
  onSearch: (v: string) => void;
}) {
  return (
    <>
      <Field name="Pesquisar Pessoa">
        <div className="secretary-search">
          <Search />
          <input
            placeholder="Nome, código, CPF ou telefone"
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      </Field>
      <Field name="Pessoa">
        <select
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Selecione</option>
          {options.map((person) => (
            <option key={String(person.id)} value={String(person.id)}>
              {String(person.full_name)} · {String(person.member_code)}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function TransferCandidateSearch({setup,value,query,onQuery,onChange}:{setup:TransferSetup|null;value:string;query:string;onQuery:(value:string)=>void;onChange:(value:string)=>void}){
  return <><Field name="Pesquisar Pessoa elegível"><div className="secretary-search"><Search/><input value={query} placeholder="Digite ao menos 3 caracteres do nome ou código" onChange={event=>onQuery(event.target.value)}/></div><small className="secretary-search-help">A busca mostra apenas nome, código, situação e unidade atual.</small></Field><Field name="Pessoa"><select required value={value} onChange={event=>onChange(event.target.value)}><option value="">Selecione</option>{(query.trim().length>=3?setup?.candidates||[]:[]).map(person=><option key={String(person.id)} value={String(person.id)}>{String(person.full_name)} · {String(person.member_code)} · {String(person.current_unit_name)} · {label(person.status)}</option>)}</select></Field>{query.trim().length>0&&query.trim().length<3?<p className="secretary-inline-note">Digite pelo menos 3 caracteres para pesquisar.</p>:null}</>;
}
function UnitSelect({
  options,
  value,
  onChange,
  name = "Unidade",
  required = true,
}: {
  options: Row[];
  value: string;
  onChange: (v: string) => void;
  name?: string;
  required?: boolean;
}) {
  return (
    <Field name={name}>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Selecione</option>
        {options.map((unit) => (
          <option key={String(unit.id)} value={String(unit.id)}>
            {String(unit.name)} · {label(unit.type)}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function SecretariaManager() {
  const params = useSearchParams(),
    { hasPermission } = useWorkspace(),
    [tab, setTab] = useState(params.get("aba") || "inicio"),
    [data, setData] = useState<Data | null>(null),
    [options, setOptions] = useState<Options>({
      people: [],
      units: [],
      functions: [],
    }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState({
      message: "",
      kind: "success" as "success" | "error",
    }),
    [report, setReport] = useState<Row | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await readApi<{ result: Data }>(
        await fetch("/api/secretary", { cache: "no-store" }),
      );
      setData(body.result);
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a Secretaria.",
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  const searchOptions = useCallback(async (search = "") => {
    try {
      const body = await readApi<{ result: Options }>(
        await fetch(
          `/api/secretary/options?search=${encodeURIComponent(search)}`,
          { cache: "no-store" },
        ),
      );
      setOptions(body.result);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Falha na pesquisa.",
        kind: "error",
      });
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      void searchOptions("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, searchOptions]);
  async function operation(payload: Row, success?: string) {
    setBusy(true);
    try {
      const body = await readApi<Row>(
        await fetch("/api/secretary/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setToast({
        message: String(body.message || success || "Operação concluída."),
        kind: "success",
      });
      await load();
      return body;
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Não foi possível concluir.",
        kind: "error",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }
  const tabs = useMemo(
    () =>
      [
        ["inicio", "Visão Geral", ClipboardList],
        ["transferencias", "Transferências", RefreshCw],
        ["movimentacoes", "Movimentações", History],
        ["batismos", "Batismos", GraduationCap],
        ["consagracoes", "Consagrações", ShieldCheck],
        ["documentos", "Documentos", FileText],
        ["modelos", "Modelos", BookCopy],
        ["relatorios", "Relatórios", CalendarDays],
      ] as const,
    [],
  );
  return (
    <>
      <AdminPageHeader
        eyebrow="Vida eclesiástica"
        title="Secretaria Eclesiástica"
        description="Movimentações, transferências, batismos, consagrações e documentos usando o cadastro único de Pessoas."
        action={
          <Link
            className="secondary-button compact-button"
            href="/painel/ajuda?categoria=Secretaria%20Eclesiástica"
          >
            Como funciona?
          </Link>
        }
      />
      <nav className="secretary-tabs">
        {tabs.map(([id, text, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon />
            {text}
          </button>
        ))}
      </nav>
      {loading && !data ? (
        <section className="content-card secretary-empty">
          <LoaderCircle className="spin" />
          Carregando Secretaria...
        </section>
      ) : null}
      {data ? (
        <main className="secretary-main">
          {tab === "inicio" ? <Overview data={data} setTab={setTab} /> : null}
          {tab === "transferencias" ? (
            <Transfers
              rows={data.requests}
              options={options}
              busy={busy}
              canRequest={hasPermission("SECRETARIA_TRANSFERENCIAS_SOLICITAR")}
              canApprove={hasPermission("SECRETARIA_TRANSFERENCIAS_APROVAR")}
              search={searchOptions}
              operation={operation}
            />
          ) : null}
          {tab === "movimentacoes" ? (
            <Movements
              rows={data.movements}
              options={options}
              busy={busy}
              canManage={hasPermission("SECRETARIA_MOVIMENTACOES_GERENCIAR")}
              search={searchOptions}
              operation={operation}
            />
          ) : null}
          {tab === "batismos" ? (
            <Baptisms
              rows={data.baptisms}
              candidates={data.baptismCandidates}
              options={options}
              busy={busy}
              canManage={hasPermission("SECRETARIA_BATISMOS_GERENCIAR")}
              search={searchOptions}
              operation={operation}
            />
          ) : null}
          {tab === "consagracoes" ? (
            <Consecrations
              rows={data.consecrations}
              options={options}
              busy={busy}
              canManage={hasPermission("SECRETARIA_CONSAGRACOES_GERENCIAR")}
              search={searchOptions}
              operation={operation}
            />
          ) : null}
          {tab === "documentos" ? (
            <Documents
              rows={data.documents}
              templates={data.templates}
              options={options}
              busy={busy}
              canIssue={hasPermission("SECRETARIA_DOCUMENTOS_EMITIR")}
              search={searchOptions}
              operation={operation}
            />
          ) : null}
          {tab === "modelos" ? (
            <Templates
              rows={data.templates}
              options={options}
              busy={busy}
              canManage={hasPermission(
                "SECRETARIA_DOCUMENTOS_MODELOS_GERENCIAR",
              )}
              operation={operation}
            />
          ) : null}
          {tab === "relatorios" ? (
            <Reports report={report} setReport={setReport} />
          ) : null}
        </main>
      ) : null}
      <Toast
        message={toast.message}
        kind={toast.kind}
        onClose={() => setToast((current) => ({ ...current, message: "" }))}
      />
    </>
  );
}

function Overview({
  data,
  setTab,
}: {
  data: Data;
  setTab: (tab: string) => void;
}) {
  const cards = [
    [
      "Transferências aguardando análise",
      data.dashboard.pending_requests,
      "transferencias",
    ],
    [
      "Documentos aguardando emissão",
      data.dashboard.pending_documents,
      "documentos",
    ],
    ["Candidatos ao batismo", data.dashboard.baptism_candidates, "batismos"],
    ["Movimentações no mês", data.dashboard.month_movements, "movimentacoes"],
  ];
  return (
    <>
      <section className="secretary-kpis">
        {cards.map(([name, value, tab]) => (
          <button key={String(name)} onClick={() => setTab(String(tab))}>
            <ClipboardList />
            <span>
              <strong>{String(value || 0)}</strong>
              {String(name)}
            </span>
          </button>
        ))}
      </section>
      <section className="content-card secretary-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Acompanhamento</p>
            <h2>Pendências recentes</h2>
          </div>
        </div>
        <RequestList rows={data.requests.slice(0, 8)} />
      </section>
    </>
  );
}
function RequestList({
  rows,
  actions,
}: {
  rows: Row[];
  actions?: (row: Row) => React.ReactNode;
}) {
  return (
    <div className="secretary-list">
      {rows.map((row) => (
        <article key={String(row.id)}>
          <RefreshCw />
          <span>
            <strong>{String(row.full_name)}</strong>
            <small>
              {row.request_direction==="RECEBIMENTO"?"Solicitação de recebimento":label(row.request_type)} · {String(row.origin_name || "—")} →{" "}
              {String(row.destination_name || row.external_church || "—")}
            </small>
            <small>{fmt(row.requested_at)}</small>
          </span>
          <StatusBadge status={String(row.status)} />
          {actions?.(row)}
        </article>
      ))}
      {!rows.length ? (
        <p className="secretary-empty-inline">
          Nenhuma solicitação encontrada.
        </p>
      ) : null}
    </div>
  );
}
function Transfers({
  rows,
  options,
  busy,
  canRequest,
  canApprove,
  search,
  operation,
}: {
  rows: Row[];
  options: Options;
  busy: boolean;
  canRequest: boolean;
  canApprove: boolean;
  search: (q: string) => void;
  operation: (p: Row) => Promise<Row | null>;
}) {
  const [open, setOpen] = useState(false),
    [transferSetup,setTransferSetup]=useState<TransferSetup|null>(null),
    [candidateQuery,setCandidateQuery]=useState(""),
    [candidateError,setCandidateError]=useState(""),
    [form, setForm] = useState({
      direction: "RECEBIMENTO",
      personId: "",
      destinationUnitId: "",
      reason: "",
      notes: "",
      departmentResolution: "REVISAR",
      ebdResolution: "REVISAR",
      effectiveDate: today(),
    });
  useEffect(()=>{if(!open)return;const term=candidateQuery.trim();if(term&&term.length<3)return;const timer=window.setTimeout(()=>{void fetch(`/api/secretary/transfer-candidates?search=${encodeURIComponent(term)}`,{cache:"no-store"}).then(response=>readApi<{result:TransferSetup}>(response)).then(body=>{setTransferSetup(body.result);setCandidateError("");setForm(current=>current.direction==="RECEBIMENTO"&&!current.destinationUnitId?{...current,destinationUnitId:String(body.result.destination.id)}:current);}).catch(error=>setCandidateError(error instanceof Error?error.message:"Não foi possível pesquisar pessoas."));},term?260:0);return()=>window.clearTimeout(timer);},[open,candidateQuery]);
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Fluxo auditado</p>
          <h2>Transferências internas</h2>
        </div>
        {canRequest ? (
          <button
            className="primary-button compact-button"
            onClick={() => {setOpen(true);setCandidateQuery("");setCandidateError("");setForm(current=>({...current,direction:"RECEBIMENTO",personId:"",destinationUnitId:transferSetup?String(transferSetup.destination.id):"",reason:"",notes:""}));}}
          >
            <Plus />
            Solicitar transferência / recebimento
          </button>
        ) : null}
      </div>
      <RequestList
        rows={rows}
        actions={(row) =>
          canApprove && row.can_review === true &&
          ["PENDENTE", "EM_ANALISE"].includes(String(row.status)) ? (
            <div className="secretary-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void operation({
                    action: "reviewTransfer",
                    requestId: row.id,
                    version: row.version,
                    status: "EM_ANALISE",
                  })
                }
              >
                Analisar
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("Motivo da recusa:");
                  if (reason)
                    void operation({
                      action: "reviewTransfer",
                      requestId: row.id,
                      version: row.version,
                      status: "RECUSADA",
                      reason,
                    });
                }}
              >
                Recusar
              </button>
              <button
                className="approve"
                disabled={busy}
                onClick={() =>
                  void operation({
                    action: "approveTransfer",
                    requestId: row.id,
                    version: row.version,
                    effectiveDate: today(),
                  })
                }
              >
                Aprovar
              </button>
            </div>
          ) : null
        }
      />
      {open ? (
        <Modal
          title={form.direction==="RECEBIMENTO"?"Solicitar recebimento de membro":"Solicitar transferência de saída"}
          onClose={() => setOpen(false)}
          wide
        >
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await operation({
                  action: "requestTransfer",
                  ...form,
                  personId: Number(form.personId),
                  destinationUnitId: Number(form.destinationUnitId),
                })
              )
                setOpen(false);
            }}
          >
            <div className="transfer-direction-picker"><button type="button" className={form.direction==="RECEBIMENTO"?"active":""} onClick={()=>{setCandidateQuery("");setForm({...form,direction:"RECEBIMENTO",personId:"",destinationUnitId:transferSetup?String(transferSetup.destination.id):""});}}><RefreshCw/> Trazer/receber membro</button><button type="button" className={form.direction==="SAIDA"?"active":""} onClick={()=>{setCandidateQuery("");setForm({...form,direction:"SAIDA",personId:"",destinationUnitId:""});}}><RefreshCw/> Enviar membro</button></div>
            {form.direction === "RECEBIMENTO" ? (
              <TransferCandidateSearch setup={transferSetup} value={form.personId} query={candidateQuery} onQuery={(value) => { setCandidateQuery(value); setForm({ ...form, personId: "" }); }} onChange={(value) => setForm({ ...form, personId: value })} />
            ) : (
              <PersonSearch options={options.people} value={form.personId} onChange={(value) => setForm({ ...form, personId: value })} onSearch={search} />
            )}
            {candidateError&&form.direction==="RECEBIMENTO"?<p className="form-feedback form-feedback-visible">{candidateError}</p>:null}
            {form.direction === "RECEBIMENTO" && transferSetup?.destinationLocked ? (
              <Field name="Unidade de destino"><div className="secretary-locked-unit"><LockKeyhole/><span><strong>{transferSetup.destination.name}</strong><small>Destino automático conforme seu acesso</small></span></div></Field>
            ) : (
              <UnitSelect name="Unidade de destino" options={form.direction === "RECEBIMENTO" ? (transferSetup?.receiveDestinations || options.units) : (transferSetup?.destinations || options.units)} value={form.destinationUnitId} onChange={(value) => setForm({ ...form, destinationUnitId: value })} />
            )}
            <Field name="Motivo">
              <input
                required
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <div className="form-grid">
              <Field name="Departamentos da unidade anterior">
                <select
                  value={form.departmentResolution}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      departmentResolution: event.target.value,
                    })
                  }
                >
                  <option value="REVISAR">Encaminhar para revisão</option>
                  <option value="ENCERRAR">Encerrar vínculos ativos</option>
                  <option value="MANTER">Manter quando permitido</option>
                </select>
              </Field>
              <Field name="Matrícula da EBD anterior">
                <select
                  value={form.ebdResolution}
                  onChange={(event) =>
                    setForm({ ...form, ebdResolution: event.target.value })
                  }
                >
                  <option value="REVISAR">Encaminhar para revisão</option>
                  <option value="ENCERRAR">Encerrar matrícula ativa</option>
                  <option value="TRANSFERIR">Preparar transferência</option>
                </select>
              </Field>
            </div>
            <Field name="Observações">
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </Field>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                Solicitar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
function Movements({
  rows,
  options,
  busy,
  canManage,
  search,
  operation,
}: {
  rows: Row[];
  options: Options;
  busy: boolean;
  canManage: boolean;
  search: (q: string) => void;
  operation: (p: Row) => Promise<Row | null>;
}) {
  const [kind, setKind] = useState<string | null>(null),
    [form, setForm] = useState({
      personId: "",
      movementType: "AFASTAMENTO",
      effectiveDate: today(),
      reason: "",
      description: "",
      notes: "",
      externalChurch: "",
      externalCity: "",
      externalState: "",
      originChurch: "",
      originCity: "",
      originState: "",
      receiptType: "CARTA",
    });
  const action =
    kind === "external"
      ? "externalTransfer"
      : kind === "receive"
        ? "receive"
        : "movement";
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Histórico imutável</p>
          <h2>Movimentações e situação eclesiástica</h2>
        </div>
        {canManage ? (
          <div className="secretary-actions">
            <button onClick={() => setKind("receive")}>Recebimento</button>
            <button onClick={() => setKind("external")}>
              Transferência externa
            </button>
            <button className="approve" onClick={() => setKind("status")}>
              <Plus />
              Nova movimentação
            </button>
          </div>
        ) : null}
      </div>
      <div className="secretary-list">
        {rows.map((row) => (
          <article key={String(row.id)}>
            <History />
            <span>
              <strong>{String(row.full_name)}</strong>
              <small>
                {label(row.movement_type)} · {String(row.description)}
              </small>
              <small>
                {fmt(row.effective_date)} · {String(row.unit_name)}
              </small>
            </span>
            <StatusBadge status={String(row.status)} />
          </article>
        ))}
      </div>
      {kind ? (
        <Modal
          title={
            kind === "receive"
              ? "Receber membro de outra igreja"
              : kind === "external"
                ? "Transferência externa"
                : "Registrar situação eclesiástica"
          }
          onClose={() => setKind(null)}
        >
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await operation({
                  action,
                  ...form,
                  personId: Number(form.personId),
                })
              )
                setKind(null);
            }}
          >
            <PersonSearch
              options={options.people}
              value={form.personId}
              onChange={(value) => setForm({ ...form, personId: value })}
              onSearch={search}
            />
            {kind === "status" ? (
              <Field name="Tipo">
                <select
                  value={form.movementType}
                  onChange={(event) =>
                    setForm({ ...form, movementType: event.target.value })
                  }
                >
                  <option value="AFASTAMENTO">Afastamento</option>
                  <option value="RETORNO">Retorno à comunhão</option>
                  <option value="DESLIGAMENTO">Desligamento</option>
                  <option value="FALECIMENTO">Falecimento</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </Field>
            ) : null}
            {kind === "external" ? (
              <>
                <Field name="Igreja de destino">
                  <input
                    required
                    value={form.externalChurch}
                    onChange={(event) =>
                      setForm({ ...form, externalChurch: event.target.value })
                    }
                  />
                </Field>
                <div className="form-grid">
                  <Field name="Cidade">
                    <input
                      value={form.externalCity}
                      onChange={(event) =>
                        setForm({ ...form, externalCity: event.target.value })
                      }
                    />
                  </Field>
                  <Field name="UF">
                    <input
                      maxLength={2}
                      value={form.externalState}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          externalState: event.target.value.toUpperCase(),
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            ) : null}
            {kind === "receive" ? (
              <>
                <Field name="Igreja de origem">
                  <input
                    required
                    value={form.originChurch}
                    onChange={(event) =>
                      setForm({ ...form, originChurch: event.target.value })
                    }
                  />
                </Field>
                <div className="form-grid">
                  <Field name="Cidade">
                    <input
                      value={form.originCity}
                      onChange={(event) =>
                        setForm({ ...form, originCity: event.target.value })
                      }
                    />
                  </Field>
                  <Field name="UF">
                    <input
                      maxLength={2}
                      value={form.originState}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          originState: event.target.value.toUpperCase(),
                        })
                      }
                    />
                  </Field>
                </div>
                <Link
                  className="secondary-button compact-button"
                  href="/painel/membros?novo=1"
                >
                  Cadastrar nova Pessoa pelo fluxo completo
                </Link>
              </>
            ) : null}
            <Field name="Data">
              <input
                type="date"
                value={form.effectiveDate}
                onChange={(event) =>
                  setForm({ ...form, effectiveDate: event.target.value })
                }
              />
            </Field>
            <Field name="Motivo / descrição">
              <textarea
                value={form.description || form.reason}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                    reason: event.target.value,
                  })
                }
              />
            </Field>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setKind(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                Registrar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
function Baptisms({
  rows,
  candidates,
  options,
  busy,
  canManage,
  search,
  operation,
}: {
  rows: Row[];
  candidates: Row[];
  options: Options;
  busy: boolean;
  canManage: boolean;
  search: (q: string) => void;
  operation: (p: Row) => Promise<Row | null>;
}) {
  const [dialog, setDialog] = useState<"event" | "candidate" | null>(null),
    [form, setForm] = useState({
      eventId: "",
      personId: "",
      unitId: "",
      title: "",
      scheduledDate: today(),
      location: "",
      notes: "",
    });
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Eventos e candidatos</p>
          <h2>Batismos</h2>
        </div>
        {canManage ? (
          <div className="secretary-actions">
            <button onClick={() => setDialog("candidate")}>
              Adicionar candidato
            </button>
            <button className="approve" onClick={() => setDialog("event")}>
              <Plus />
              Novo evento
            </button>
          </div>
        ) : null}
      </div>
      <div className="secretary-card-grid">
        {rows.map((row) => (
          <article key={String(row.id)}>
            <GraduationCap />
            <div>
              <strong>{String(row.title)}</strong>
              <span>
                {fmt(row.scheduled_date)} ·{" "}
                {String(row.location || row.unit_name)}
              </span>
              <small>
                {String(row.candidate_count || 0)} candidatos ·{" "}
                {String(row.completed_count || 0)} realizados
              </small>
            </div>
            <StatusBadge status={String(row.status)} />
          </article>
        ))}
      </div>
      <div className="section-heading-row secretary-subheading">
        <div>
          <p className="eyebrow">Lista nominal</p>
          <h3>Candidatos e realizados</h3>
        </div>
      </div>
      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Evento</th>
              <th>Data</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={`${candidate.event_id}-${candidate.person_id}`}>
                <td>
                  <strong>{String(candidate.full_name)}</strong>
                </td>
                <td>{String(candidate.event_title)}</td>
                <td>{fmt(candidate.scheduled_date)}</td>
                <td>
                  <StatusBadge status={String(candidate.status)} />
                </td>
                <td>
                  {canManage && candidate.status !== "REALIZADO" ? (
                    <button
                      className="approve compact-button"
                      disabled={busy}
                      onClick={async () => {
                        const overwrite = candidate.baptism_date
                          ? window.confirm(
                              `A ficha já possui batismo em ${fmt(candidate.baptism_date)}. Deseja substituir pela data deste evento?`,
                            )
                          : true;
                        if (!overwrite) return;
                        await operation({
                          action: "completeBaptism",
                          eventId: Number(candidate.event_id),
                          personId: Number(candidate.person_id),
                          confirmOverwrite: Boolean(candidate.baptism_date),
                        });
                      }}
                    >
                      Concluir batismo
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog ? (
        <Modal
          title={
            dialog === "event"
              ? "Novo evento de batismo"
              : "Adicionar candidato ao batismo"
          }
          onClose={() => setDialog(null)}
        >
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const payload =
                dialog === "event"
                  ? {
                      action: "createBaptismEvent",
                      ...form,
                      unitId: Number(form.unitId),
                    }
                  : {
                      action: "addBaptismCandidate",
                      ...form,
                      eventId: Number(form.eventId),
                      personId: Number(form.personId),
                    };
              if (await operation(payload)) setDialog(null);
            }}
          >
            {dialog === "event" ? (
              <>
                <UnitSelect
                  options={options.units}
                  value={form.unitId}
                  onChange={(value) => setForm({ ...form, unitId: value })}
                />
                <Field name="Título">
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                  />
                </Field>
                <Field name="Data prevista">
                  <input
                    type="date"
                    required
                    value={form.scheduledDate}
                    onChange={(event) =>
                      setForm({ ...form, scheduledDate: event.target.value })
                    }
                  />
                </Field>
                <Field name="Local">
                  <input
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                  />
                </Field>
              </>
            ) : (
              <>
                <Field name="Evento">
                  <select
                    required
                    value={form.eventId}
                    onChange={(event) =>
                      setForm({ ...form, eventId: event.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {rows
                      .filter((row) => row.status !== "CANCELADO")
                      .map((row) => (
                        <option value={String(row.id)} key={String(row.id)}>
                          {String(row.title)} · {fmt(row.scheduled_date)}
                        </option>
                      ))}
                  </select>
                </Field>
                <PersonSearch
                  options={options.people}
                  value={form.personId}
                  onChange={(value) => setForm({ ...form, personId: value })}
                  onSearch={search}
                />
              </>
            )}
            <Field name="Observações">
              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </Field>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
function Consecrations({
  rows,
  options,
  busy,
  canManage,
  search,
  operation,
}: {
  rows: Row[];
  options: Options;
  busy: boolean;
  canManage: boolean;
  search: (q: string) => void;
  operation: (p: Row) => Promise<Row | null>;
}) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState({
      personId: "",
      unitId: "",
      newFunctionId: "",
      eventDate: today(),
      location: "",
      notes: "",
    });
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Funções estruturadas</p>
          <h2>Consagrações</h2>
        </div>
        {canManage ? (
          <button
            className="primary-button compact-button"
            onClick={() => setOpen(true)}
          >
            <Plus />
            Registrar consagração
          </button>
        ) : null}
      </div>
      <div className="secretary-list">
        {rows.map((row) => (
          <article key={String(row.id)}>
            <ShieldCheck />
            <span>
              <strong>{String(row.full_name)}</strong>
              <small>
                {String(row.new_function_name)} · {fmt(row.event_date)} ·{" "}
                {String(row.unit_name)}
              </small>
            </span>
            <StatusBadge status={String(row.status)} />
            {canManage && row.status !== "REALIZADA" ? (
              <button
                className="primary-button compact-button"
                disabled={busy}
                onClick={() =>
                  void operation({
                    action: "completeConsecration",
                    consecrationId: row.id,
                    version: row.version,
                  })
                }
              >
                Concluir
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {open ? (
        <Modal title="Nova consagração" onClose={() => setOpen(false)}>
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await operation({
                  action: "createConsecration",
                  ...form,
                  personId: Number(form.personId),
                  unitId: Number(form.unitId),
                  newFunctionId: Number(form.newFunctionId),
                })
              )
                setOpen(false);
            }}
          >
            <PersonSearch
              options={options.people}
              value={form.personId}
              onChange={(value) => setForm({ ...form, personId: value })}
              onSearch={search}
            />
            <UnitSelect
              options={options.units}
              value={form.unitId}
              onChange={(value) => setForm({ ...form, unitId: value })}
            />
            <Field name="Nova função">
              <select
                required
                value={form.newFunctionId}
                onChange={(event) =>
                  setForm({ ...form, newFunctionId: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {options.functions.map((item) => (
                  <option value={String(item.id)} key={String(item.id)}>
                    {String(item.name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="Data">
              <input
                type="date"
                value={form.eventDate}
                onChange={(event) =>
                  setForm({ ...form, eventDate: event.target.value })
                }
              />
            </Field>
            <Field name="Local">
              <input
                value={form.location}
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
              />
            </Field>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
function Documents({
  rows,
  templates,
  options,
  busy,
  canIssue,
  search,
  operation,
}: {
  rows: Row[];
  templates: Row[];
  options: Options;
  busy: boolean;
  canIssue: boolean;
  search: (q: string) => void;
  operation: (p: Row) => Promise<Row | null>;
}) {
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState<Row | null>(null),
    [form, setForm] = useState({ personId: "", templateId: "" });
  async function previewDocument() {
    const result = await operation({
      action: "previewDocument",
      personId: Number(form.personId),
      templateId: Number(form.templateId),
    });
    if (result) setPreview(result.preview as Row);
  }
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Modelos versionados</p>
          <h2>Documentos eclesiásticos emitidos</h2>
        </div>
        {canIssue ? (
          <button
            className="primary-button compact-button"
            onClick={() => setOpen(true)}
          >
            <FileText />
            Emitir documento
          </button>
        ) : null}
      </div>
      <div className="department-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Pessoa</th>
              <th>Tipo</th>
              <th>Unidade</th>
              <th>Emissão</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>
                  <strong>{String(row.document_number)}</strong>
                </td>
                <td>{String(row.full_name)}</td>
                <td>{label(row.document_type)}</td>
                <td>{String(row.unit_name)}</td>
                <td>{fmt(row.issued_at)}</td>
                <td>
                  <Link
                    target="_blank"
                    href={`/painel/secretaria/documentos/${row.id}/imprimir`}
                  >
                    Imprimir / PDF
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal
          title="Emitir documento"
          onClose={() => {
            setOpen(false);
            setPreview(null);
          }}
          wide
        >
          <div className="admin-form">
            <PersonSearch
              options={options.people}
              value={form.personId}
              onChange={(value) => setForm({ ...form, personId: value })}
              onSearch={search}
            />
            <Field name="Modelo">
              <select
                required
                value={form.templateId}
                onChange={(event) =>
                  setForm({ ...form, templateId: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {templates.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {String(item.name)} · versão {String(item.current_version)}
                  </option>
                ))}
              </select>
            </Field>
            {preview ? (
              <article className="document-preview">
                <small>{String(preview.header || "")}</small>
                <h2>{String(preview.title)}</h2>
                <p>{String(preview.body)}</p>
                {((preview.signatures as string[]) || []).map((signature) => (
                  <div key={signature}>
                    ____________________________
                    <br />
                    {signature}
                  </div>
                ))}
              </article>
            ) : null}
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => void previewDocument()}
              >
                Visualizar antes de emitir
              </button>
              <button
                className="primary-button"
                disabled={busy || !preview}
                onClick={async () => {
                  const result = await operation({
                    action: "issueDocument",
                    personId: Number(form.personId),
                    templateId: Number(form.templateId),
                  });
                  if (result) {
                    setOpen(false);
                    window.open(
                      `/painel/secretaria/documentos/${String(result.documentId)}/imprimir`,
                      "_blank",
                    );
                  }
                }}
              >
                Emitir documento
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
function Templates({
  rows,
  options,
  busy,
  canManage,
  operation,
}: {
  rows: Row[];
  options: Options;
  busy: boolean;
  canManage: boolean;
  operation: (p: Row) => Promise<Row | null>;
}) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState({
      templateId: "",
      unitId: "",
      name: "",
      documentType: "DECLARACAO_MEMBRO",
      title: "Declaração",
      body: "Declaramos para os devidos fins que {nome_membro}, código {codigo_membro}, é membro desta igreja.",
      headerText: "{nome_igreja}",
      footerText: "{cidade}, {data_atual}",
      signatures: "Pastor Presidente\nSecretário",
      align: "justify",
      fontSize: "12",
      margin: "20",
    });
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Editor seguro</p>
          <h2>Modelos de documentos</h2>
        </div>
        {canManage ? (
          <button
            className="primary-button compact-button"
            onClick={() => setOpen(true)}
          >
            <Plus />
            Novo modelo
          </button>
        ) : null}
      </div>
      <div className="secretary-card-grid">
        {rows.map((row) => (
          <article key={String(row.id)}>
            <BookCopy />
            <div>
              <strong>{String(row.name)}</strong>
              <span>
                {label(row.document_type)} · versão{" "}
                {String(row.current_version)}
              </span>
              <small>{String(row.title)}</small>
            </div>
            <StatusBadge status={String(row.status)} />
            {canManage ? (
              <button
                onClick={() => {
                  setForm({
                    ...form,
                    templateId: String(row.id),
                    unitId: String(row.unit_id || ""),
                    name: String(row.name),
                    documentType: String(row.document_type),
                    title: String(row.title),
                    body: String(row.body),
                    headerText: String(row.header_text || ""),
                    footerText: String(row.footer_text || ""),
                    signatures: ((row.signatures as string[]) || []).join("\n"),
                  });
                  setOpen(true);
                }}
              >
                Editar
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {open ? (
        <Modal
          title={form.templateId ? "Nova versão do modelo" : "Novo modelo"}
          onClose={() => setOpen(false)}
          wide
        >
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await operation({
                  action: "saveTemplate",
                  ...form,
                  templateId: Number(form.templateId) || null,
                  unitId: Number(form.unitId) || null,
                  signatures: form.signatures.split("\n"),
                  fontSize: Number(form.fontSize),
                  margin: Number(form.margin),
                })
              )
                setOpen(false);
            }}
          >
            <div className="form-grid">
              <Field name="Nome">
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </Field>
              <Field name="Tipo">
                <select
                  value={form.documentType}
                  onChange={(event) =>
                    setForm({ ...form, documentType: event.target.value })
                  }
                >
                  <option value="DECLARACAO_MEMBRO">
                    Declaração de membro
                  </option>
                  <option value="DECLARACAO_CONGREGADO">
                    Declaração de congregado
                  </option>
                  <option value="CARTA_RECOMENDACAO">
                    Carta de recomendação
                  </option>
                  <option value="CARTA_TRANSFERENCIA">
                    Carta de transferência
                  </option>
                  <option value="CERTIFICADO_BATISMO">
                    Certificado de batismo
                  </option>
                  <option value="CERTIFICADO_CONSAGRACAO">
                    Certificado de consagração
                  </option>
                  <option value="DECLARACAO_FUNCAO">
                    Declaração de função
                  </option>
                  <option value="PERSONALIZADA">Personalizada</option>
                </select>
              </Field>
            </div>
            <UnitSelect
              name="Unidade específica (opcional)"
              required={false}
              options={options.units}
              value={form.unitId}
              onChange={(value) => setForm({ ...form, unitId: value })}
            />
            <Field name="Cabeçalho">
              <input
                value={form.headerText}
                onChange={(event) =>
                  setForm({ ...form, headerText: event.target.value })
                }
              />
            </Field>
            <Field name="Título">
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </Field>
            <Field name="Corpo">
              <textarea
                rows={10}
                required
                value={form.body}
                onChange={(event) =>
                  setForm({ ...form, body: event.target.value })
                }
              />
            </Field>
            <Field name="Rodapé">
              <input
                value={form.footerText}
                onChange={(event) =>
                  setForm({ ...form, footerText: event.target.value })
                }
              />
            </Field>
            <Field name="Assinaturas — uma por linha">
              <textarea
                value={form.signatures}
                onChange={(event) =>
                  setForm({ ...form, signatures: event.target.value })
                }
              />
            </Field>
            <p className="template-variables">
              Variáveis: {"{nome_membro}"}, {"{codigo_membro}"}, {"{cpf}"},{" "}
              {"{rg}"}, {"{data_nascimento}"}, {"{funcao}"}, {"{matriz}"},{" "}
              {"{filial}"}, {"{nome_igreja}"}, {"{cidade}"}, {"{data_atual}"},{" "}
              {"{data_batismo}"}.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={busy}>
                Salvar versão
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
function Reports({
  report,
  setReport,
}: {
  report: Row | null;
  setReport: (r: Row | null) => void;
}) {
  const [from, setFrom] = useState(
      new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(today()),
    [type, setType] = useState("");
  async function load() {
    const body = await readApi<{ result: Row }>(
      await fetch(`/api/secretary/reports?from=${from}&to=${to}&type=${type}`, {
        cache: "no-store",
      }),
    );
    setReport(body.result);
  }
  const rows = (report?.movements || []) as Row[],
    documents = (report?.documents || []) as Row[];
  return (
    <section className="content-card secretary-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Até mil registros por consulta</p>
          <h2>Relatórios da Secretaria</h2>
        </div>
      </div>
      <div className="report-filters">
        <Field name="De">
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </Field>
        <Field name="Até">
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </Field>
        <Field name="Tipo">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">Todos</option>
            {[
              "RECEBIMENTO",
              "TRANSFERENCIA_INTERNA",
              "TRANSFERENCIA_EXTERNA",
              "AFASTAMENTO",
              "RETORNO",
              "DESLIGAMENTO",
              "FALECIMENTO",
              "BATISMO",
              "CONSAGRACAO",
            ].map((item) => (
              <option key={item}>{label(item)}</option>
            ))}
          </select>
        </Field>
        <button className="primary-button" onClick={() => void load()}>
          Gerar relatório
        </button>
      </div>
      {report ? (
        <>
          <section className="secretary-kpis">
            <button>
              <History />
              <span>
                <strong>{rows.length}</strong>Movimentações
              </span>
            </button>
            <button>
              <FileText />
              <span>
                <strong>{documents.length}</strong>Documentos emitidos
              </span>
            </button>
          </section>
          <div className="department-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pessoa</th>
                  <th>Tipo</th>
                  <th>Unidade</th>
                  <th>Descrição</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{fmt(row.effective_date)}</td>
                    <td>{String(row.full_name)}</td>
                    <td>{label(row.movement_type)}</td>
                    <td>{String(row.unit_name)}</td>
                    <td>{String(row.description)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

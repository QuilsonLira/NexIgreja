"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  Copy,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  AdminPageHeader,
  readApi,
  StatusBadge,
  Toast,
} from "@/components/admin/admin-ui";
import { useWorkspace } from "@/components/protected-shell";
import {
  DEPARTMENT_LOCAL_PERMISSIONS,
  type DepartmentOverview,
  type DepartmentRecord,
} from "@/lib/departments/types";

type ToastState = { message: string; kind: "success" | "error" };
type Option = {
  id: number;
  full_name?: string;
  display_name?: string;
  member_number?: number;
  role_name?: string;
  phone?: string;
  whatsapp?: string;
};
type MeetingData = {
  meeting: Record<string, unknown>;
  classes: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  visitors: Array<Record<string, unknown>>;
  closure: Record<string, unknown> | null;
  canSeeAll: boolean;
};
const money = (cents: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(cents || 0) / 100,
  );
const date = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${String(value).slice(0, 10)}T12:00:00Z`),
      )
    : "—";
const label = (value: unknown) => String(value ?? "").replaceAll("_", " ");
const initialCreate = {
  name: "",
  acronym: "",
  description: "",
  type: "DEPARTAMENTO",
  unitId: "",
  absenceAlertThreshold: "3",
  enabledFeatures: ["PARTICIPANTES", "AGENDA", "FREQUENCIA", "COMUNICACAO"],
};

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
        className={`dialog-card department-dialog${wide ? " department-dialog-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="department-dialog-header">
          <div>
            <p className="eyebrow">NexIgreja</p>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Field({
  label: fieldLabel,
  children,
  span = false,
}: {
  label: string;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <label className={`field-group${span ? " form-span-2" : ""}`}>
      <span>{fieldLabel}</span>
      {children}
    </label>
  );
}
function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="primary-button compact-button"
      type="submit"
      disabled={busy}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : null}
      {children}
    </button>
  );
}

export function DepartmentsManager() {
  const params = useSearchParams(),
    requestedId = Number(params.get("abrir")) || null,
    requestedTab = params.get("aba") || "inicio",
    { admin, hasPermission } = useWorkspace();
  const [items, setItems] = useState<DepartmentRecord[]>([]),
    [selected, setSelected] = useState<number | null>(requestedId),
    [overview, setOverview] = useState<DepartmentOverview | null>(null),
    [tab, setTab] = useState(requestedTab),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [createOpen, setCreateOpen] = useState(false),
    [create, setCreate] = useState(initialCreate),
    [toast, setToast] = useState<ToastState>({ message: "", kind: "success" }),
    [search, setSearch] = useState(""),
    [options, setOptions] = useState<{
      people: Option[];
      memberships: Option[];
    }>({ people: [], memberships: [] }),
    [meeting, setMeeting] = useState<MeetingData | null>(null),
    [meetingId, setMeetingId] = useState(Number(params.get("encontro")) || 0),
    [classId, setClassId] = useState(0),
    [attendance, setAttendance] = useState<Record<number, string>>({}),
    [report, setReport] = useState<Record<string, unknown> | null>(null);
  const can = (permission: string) =>
    Boolean(
      hasPermission(permission as Parameters<typeof hasPermission>[0]) &&
      (overview?.department.accessMode === "ADMIN" ||
        overview?.department.permissions.includes(permission)),
    );
  const loadList = useCallback(async () => {
    const body = await readApi<{ result: { items: DepartmentRecord[] } }>(
      await fetch(`/api/departments?search=${encodeURIComponent(search)}`, {
        cache: "no-store",
      }),
    );
    setItems(body.result.items);
    if (!selected && body.result.items.length)
      setSelected(body.result.items[0].id);
  }, [search, selected]);
  const loadOverview = useCallback(async (id: number) => {
    const body = await readApi<{ result: DepartmentOverview }>(
      await fetch(`/api/departments/${id}`, { cache: "no-store" }),
    );
    setOverview(body.result);
  }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          await loadList();
          if (selected) await loadOverview(selected);
        } catch (e) {
          if (active)
            setToast({
              message:
                e instanceof Error
                  ? e.message
                  : "Não foi possível carregar os departamentos.",
              kind: "error",
            });
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadList, loadOverview, selected]);
  async function refresh() {
    if (selected) await loadOverview(selected);
    await loadList();
  }
  async function operation(payload: Record<string, unknown>, success?: string) {
    if (!selected) return null;
    setBusy(true);
    try {
      const body = await readApi<
        Record<string, unknown> & { message?: string }
      >(
        await fetch(`/api/departments/${selected}/operations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      setToast({
        message: body.message || success || "Operação concluída.",
        kind: "success",
      });
      await refresh();
      return body;
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Não foi possível concluir.",
        kind: "error",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function searchOptions(value = "") {
    if (!selected) return;
    try {
      const body = await readApi<{
        result: { people: Option[]; memberships: Option[] };
      }>(
        await fetch(
          `/api/departments/${selected}/options?search=${encodeURIComponent(value)}`,
          { cache: "no-store" },
        ),
      );
      setOptions(body.result);
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Falha ao pesquisar.",
        kind: "error",
      });
    }
  }
  async function createDepartment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = await readApi<{ id: number }>(
        await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...create,
            unitId: Number(create.unitId),
            absenceAlertThreshold: Number(create.absenceAlertThreshold),
          }),
        }),
      );
      setCreateOpen(false);
      setCreate(initialCreate);
      setSelected(body.id);
      setToast({ message: "Departamento criado.", kind: "success" });
      await loadList();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Não foi possível criar.",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }
  async function openMeeting(nextMeetingId: number, nextClassId = 0) {
    if (!selected || !nextMeetingId) return;
    setMeetingId(nextMeetingId);
    setClassId(nextClassId);
    const body = await operation({
      action: "meeting",
      meetingId: nextMeetingId,
      classId: nextClassId,
    });
    if (body) {
      const data = body as unknown as MeetingData & {
        meeting?: Record<string, unknown>;
      };
      setMeeting({
        meeting: data.meeting,
        classes: data.classes,
        students: data.students,
        visitors: data.visitors,
        closure: data.closure,
        canSeeAll: data.canSeeAll,
      });
      setAttendance(
        Object.fromEntries(
          data.students.map((student) => [
            Number(student.student_id),
            String(student.attendance_status),
          ]),
        ),
      );
    }
  }
  const activeClass = meeting?.classes.find(
    (item) => Number(item.id) === classId,
  );
  const tabs = useMemo(
    () => [
      { id: "inicio", label: "Início", icon: LayoutDashboard },
      { id: "participantes", label: "Participantes", icon: Users },
      { id: "agenda", label: "Agenda", icon: CalendarDays },
      { id: "frequencia", label: "Frequência", icon: ClipboardCheck },
      { id: "comunicacao", label: "Comunicação", icon: Megaphone },
      { id: "acessos", label: "Liderança e acessos", icon: ShieldCheck },
      ...(overview?.department.type === "ESCOLA_BIBLICA" ||
      overview?.department.enabledFeatures.includes("EBD")
        ? [
            { id: "ebd", label: "Escola Bíblica", icon: GraduationCap },
            { id: "chamada", label: "Chamada", icon: BookOpen },
            { id: "relatorios", label: "Relatórios", icon: ClipboardCheck },
          ]
        : []),
    ],
    [overview],
  );
  return (
    <>
      <AdminPageHeader
        eyebrow="Gestão ministerial"
        title="Departamentos e Escola Bíblica"
        description="Áreas administrativas independentes, com acesso individual, participantes, agenda, frequência e EBD."
        action={
          hasPermission("DEPARTAMENTO_CONFIGURAR") ? (
            <button
              className="primary-button compact-button"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={18} />
              Novo departamento
            </button>
          ) : undefined
        }
      />
      <section className="department-workspace">
        <aside className="content-card department-list-panel">
          <div className="department-search">
            <Search size={17} />
            <input
              placeholder="Buscar departamento"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading && !items.length ? (
            <div className="department-empty">
              <LoaderCircle className="spin" />
              Carregando...
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                className={selected === item.id ? "active" : ""}
                onClick={() => {
                  setSelected(item.id);
                  setTab("inicio");
                  setMeeting(null);
                }}
              >
                <span className="department-list-icon">
                  {item.type === "ESCOLA_BIBLICA" ? (
                    <GraduationCap size={20} />
                  ) : (
                    <Users size={20} />
                  )}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.unitName} · {label(item.type)}
                  </small>
                </span>
                <StatusBadge status={item.status} />
              </button>
            ))
          )}
          {!loading && !items.length ? (
            <div className="department-empty">
              <Users />
              <strong>Nenhum departamento</strong>
              <span>Crie a primeira área ministerial.</span>
            </div>
          ) : null}
        </aside>
        <main className="department-main">
          {overview ? (
            <>
              <header className="content-card department-hero">
                <div>
                  <p className="eyebrow">{label(overview.department.type)}</p>
                  <h2>{overview.department.name}</h2>
                  <p>
                    {overview.department.description ||
                      `${overview.department.unitName} · gestão departamental segura`}
                  </p>
                </div>
                <div>
                  <StatusBadge status={overview.department.status} />
                  <span>
                    {overview.department.accessMode === "ADMIN"
                      ? "Administração do escopo"
                      : "Acesso individual"}
                  </span>
                </div>
              </header>
              <nav
                className="department-tabs"
                aria-label="Áreas do departamento"
              >
                {tabs.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      className={tab === item.id ? "active" : ""}
                      onClick={() => setTab(item.id)}
                    >
                      <Icon size={17} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
              {tab === "inicio" ? <Overview overview={overview} /> : null}
              {tab === "participantes" ? (
                <Participants
                  overview={overview}
                  busy={busy}
                  canManage={can("DEPARTAMENTO_PARTICIPANTES_GERENCIAR")}
                  options={options.people}
                  searchOptions={searchOptions}
                  operation={operation}
                />
              ) : null}
              {tab === "agenda" ? (
                <Agenda
                  overview={overview}
                  busy={busy}
                  canManage={can("DEPARTAMENTO_AGENDA_GERENCIAR")}
                  operation={operation}
                />
              ) : null}
              {tab === "frequencia" ? (
                <DepartmentAttendance
                  overview={overview}
                  busy={busy}
                  canManage={can("DEPARTAMENTO_FREQUENCIA_LANCAR")}
                  operation={operation}
                />
              ) : null}
              {tab === "comunicacao" ? (
                <Communication
                  overview={overview}
                  busy={busy}
                  canManage={can("DEPARTAMENTO_COMUNICACAO")}
                  operation={operation}
                />
              ) : null}
              {tab === "acessos" ? (
                <Access
                  overview={overview}
                  busy={busy}
                  canManage={can("DEPARTAMENTO_LIDERANCA_GERENCIAR")}
                  memberships={options.memberships}
                  searchOptions={searchOptions}
                  operation={operation}
                />
              ) : null}
              {tab === "ebd" ? (
                <EbdManagement
                  overview={overview}
                  busy={busy}
                  canClasses={can("EBD_CLASSES_GERENCIAR")}
                  canStudents={can("EBD_ALUNOS_GERENCIAR")}
                  people={options.people}
                  memberships={options.memberships}
                  searchOptions={searchOptions}
                  operation={operation}
                />
              ) : null}
              {tab === "chamada" ? (
                <EbdAttendance
                  overview={overview}
                  busy={busy}
                  meeting={meeting}
                  meetingId={meetingId}
                  classId={classId}
                  attendance={attendance}
                  activeClass={activeClass}
                  setAttendance={setAttendance}
                  openMeeting={openMeeting}
                  operation={operation}
                />
              ) : null}
              {tab === "relatorios" ? (
                <Reports
                  overview={overview}
                  report={report}
                  setReport={setReport}
                />
              ) : null}
            </>
          ) : (
            <div className="content-card department-empty page-empty">
              {loading ? <LoaderCircle className="spin" /> : <Users />}
              <h2>Selecione um departamento</h2>
            </div>
          )}
        </main>
      </section>
      {createOpen ? (
        <Modal title="Novo departamento" onClose={() => setCreateOpen(false)}>
          <form className="admin-form" onSubmit={createDepartment}>
            <div className="form-grid">
              <Field label="Nome">
                <input
                  required
                  value={create.name}
                  onChange={(e) =>
                    setCreate({ ...create, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Sigla">
                <input
                  value={create.acronym}
                  onChange={(e) =>
                    setCreate({ ...create, acronym: e.target.value })
                  }
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={create.type}
                  onChange={(e) =>
                    setCreate({ ...create, type: e.target.value })
                  }
                >
                  {[
                    "DEPARTAMENTO",
                    "MINISTERIO",
                    "GRUPO",
                    "EQUIPE",
                    "ESCOLA_BIBLICA",
                    "OUTRO",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unidade">
                <select
                  required
                  value={create.unitId}
                  onChange={(e) =>
                    setCreate({ ...create, unitId: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  <option value={admin.unitOptions.convention.id}>
                    Convenção · {admin.unitOptions.convention.name}
                  </option>
                  {admin.unitOptions.matrices.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      Matriz · {unit.name}
                    </option>
                  ))}
                  {admin.unitOptions.branches.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      Filial · {unit.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Descrição" span>
                <textarea
                  value={create.description}
                  onChange={(e) =>
                    setCreate({ ...create, description: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Criar departamento</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
      <Toast {...toast} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

function Overview({ overview }: { overview: DepartmentOverview }) {
  const d = overview.department;
  return (
    <>
      <section className="department-kpis">
        <article>
          <Users />
          <span>
            <strong>{d.participantCount}</strong>Participantes ativos
          </span>
        </article>
        <article>
          <CalendarDays />
          <span>
            <strong>{d.nextEvent ? date(d.nextEvent) : "—"}</strong>Próximo
            evento
          </span>
        </article>
        <article>
          <ClipboardCheck />
          <span>
            <strong>
              {d.averageAttendance === null ? "—" : `${d.averageAttendance}%`}
            </strong>
            Frequência média
          </span>
        </article>
        <article>
          <GraduationCap />
          <span>
            <strong>{d.classCount}</strong>Classes da EBD
          </span>
        </article>
      </section>
      <section className="content-card department-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Visão geral</p>
            <h2>Próximos compromissos</h2>
          </div>
        </div>
        <div className="department-event-list">
          {overview.events
            .filter((e) => String(e.status) === "AGENDADO")
            .slice(0, 5)
            .map((e) => (
              <article key={String(e.id)}>
                <CalendarDays />
                <span>
                  <strong>{String(e.title)}</strong>
                  <small>
                    {date(e.event_date)}{" "}
                    {e.start_time ? `às ${e.start_time}` : ""} ·{" "}
                    {String(e.location || "Local não informado")}
                  </small>
                </span>
              </article>
            ))}
          {!overview.events.length ? (
            <p className="muted">Nenhum evento agendado.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}

function Participants({
  overview,
  busy,
  canManage,
  options,
  searchOptions,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  canManage: boolean;
  options: Option[];
  searchOptions: (q?: string) => Promise<void>;
  operation: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = useState({
      personId: "",
      roleId: "",
      joinedAt: new Date().toISOString().slice(0, 10),
      notes: "",
    }),
    [open, setOpen] = useState(false);
  return (
    <section className="content-card department-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Cadastro único de pessoas</p>
          <h2>Participantes</h2>
        </div>
        {canManage ? (
          <button
            className="primary-button compact-button"
            onClick={() => {
              setOpen(true);
              void searchOptions("");
            }}
          >
            <Plus size={17} />
            Adicionar
          </button>
        ) : null}
      </div>
      <div className="department-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Função no departamento</th>
              <th>Contato</th>
              <th>Entrada</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {overview.participants.map((p) => (
              <tr key={String(p.person_id)}>
                <td>
                  <strong>{String(p.full_name)}</strong>
                  <small>#{String(p.member_number).padStart(6, "0")}</small>
                </td>
                <td>{String(p.role_name || "Participante")}</td>
                <td>{String(p.whatsapp || p.phone || "—")}</td>
                <td>{date(p.joined_at)}</td>
                <td>
                  <StatusBadge status={String(p.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!overview.participants.length ? (
          <p className="department-inline-empty">
            Nenhum participante adicionado.
          </p>
        ) : null}
      </div>
      {open ? (
        <Modal title="Adicionar participante" onClose={() => setOpen(false)}>
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await operation({
                  action: "addParticipant",
                  personId: Number(form.personId),
                  roleId: Number(form.roleId) || null,
                  joinedAt: form.joinedAt,
                  notes: form.notes,
                })
              )
                setOpen(false);
            }}
          >
            <Field label="Pesquisar pessoa">
              <input
                placeholder="Digite um nome"
                onChange={(e) => void searchOptions(e.target.value)}
              />
            </Field>
            <Field label="Pessoa">
              <select
                required
                value={form.personId}
                onChange={(e) => setForm({ ...form, personId: e.target.value })}
              >
                <option value="">Selecione</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} · #
                    {String(p.member_number || "").padStart(6, "0")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Função no departamento">
              <select
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              >
                <option value="">Participante</option>
                {overview.roles
                  .filter((r) => String(r.status) === "ATIVO")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Data de entrada">
              <input
                type="date"
                value={form.joinedAt}
                onChange={(e) => setForm({ ...form, joinedAt: e.target.value })}
              />
            </Field>
            <Field label="Observação">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              <Submit busy={busy}>Adicionar</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function Agenda({
  overview,
  busy,
  canManage,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  canManage: boolean;
  operation: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState({
      title: "",
      description: "",
      eventDate: "",
      startTime: "",
      location: "",
      notes: "",
    });
  return (
    <section className="content-card department-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Agenda exclusiva</p>
          <h2>Eventos do departamento</h2>
        </div>
        {canManage ? (
          <button
            className="primary-button compact-button"
            onClick={() => setOpen(true)}
          >
            <Plus size={17} />
            Novo evento
          </button>
        ) : null}
      </div>
      <div className="department-event-list">
        {overview.events.map((event) => (
          <article key={String(event.id)}>
            <CalendarDays />
            <span>
              <strong>{String(event.title)}</strong>
              <small>
                {date(event.event_date)}{" "}
                {event.start_time ? `às ${event.start_time}` : ""} ·{" "}
                {String(event.location || "Local não informado")}
              </small>
            </span>
            <StatusBadge status={String(event.status)} />
          </article>
        ))}
      </div>
      {open ? (
        <Modal title="Novo evento" onClose={() => setOpen(false)}>
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await operation({ action: "createEvent", ...form }))
                setOpen(false);
            }}
          >
            <div className="form-grid">
              <Field label="Título" span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </Field>
              <Field label="Data">
                <input
                  required
                  type="date"
                  value={form.eventDate}
                  onChange={(e) =>
                    setForm({ ...form, eventDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Hora">
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </Field>
              <Field label="Local" span>
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </Field>
              <Field label="Descrição" span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Salvar evento</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function DepartmentAttendance({
  overview,
  busy,
  canManage,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  canManage: boolean;
  operation: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [form, setForm] = useState({
      title: "Reunião do departamento",
      activityDate: new Date().toISOString().slice(0, 10),
      notes: "",
    }),
    [call, setCall] = useState<{
      activity: Record<string, unknown>;
      participants: Array<Record<string, unknown>>;
    } | null>(null),
    [marks, setMarks] = useState<Record<number, string>>({});
  async function openCall(activityId: number) {
    const result = (await operation({ action: "activity", activityId })) as {
      activity: Record<string, unknown>;
      participants: Array<Record<string, unknown>>;
    } | null;
    if (result) {
      setCall(result);
      setMarks(
        Object.fromEntries(
          result.participants.map((person) => [
            Number(person.person_id),
            String(person.attendance_status),
          ]),
        ),
      );
    }
  }
  const records = Object.entries(marks).map(([personId, status]) => ({
      personId: Number(personId),
      status,
    })),
    editable = canManage && call?.activity.status !== "FINALIZADA";
  return (
    <section className="content-card department-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Histórico individual</p>
          <h2>Frequência departamental</h2>
        </div>
        {canManage ? (
          <button
            className="primary-button compact-button"
            onClick={() => setOpen(true)}
          >
            <Plus size={17} />
            Nova chamada
          </button>
        ) : null}
      </div>
      <div className="department-event-list">
        {overview.activities.map((activity) => (
          <article key={String(activity.id)}>
            <ClipboardCheck />
            <span>
              <strong>{String(activity.title)}</strong>
              <small>
                {date(activity.activity_date)} ·{" "}
                {String(activity.present_count || 0)} presentes
              </small>
            </span>
            <button
              className="secondary-button compact-button"
              onClick={() => void openCall(Number(activity.id))}
            >
              Abrir
            </button>
            <StatusBadge status={String(activity.status)} />
          </article>
        ))}
      </div>
      {open ? (
        <Modal title="Nova chamada" onClose={() => setOpen(false)}>
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await operation({ action: "createActivity", ...form }))
                setOpen(false);
            }}
          >
            <Field label="Atividade">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={form.activityDate}
                onChange={(e) =>
                  setForm({ ...form, activityDate: e.target.value })
                }
              />
            </Field>
            <Field label="Observação">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              <Submit busy={busy}>Criar chamada</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
      {call ? (
        <Modal
          title={String(call.activity.title)}
          onClose={() => setCall(null)}
          wide
        >
          <header className="call-mobile-header">
            <div>
              <strong>{date(call.activity.activity_date)}</strong>
              <span>
                {call.participants.length} participantes ·{" "}
                {label(call.activity.status)}
              </span>
            </div>
            {editable ? (
              <button
                onClick={() =>
                  setMarks(
                    Object.fromEntries(
                      call.participants.map((person) => [
                        Number(person.person_id),
                        "PRESENTE",
                      ]),
                    ),
                  )
                }
              >
                <Check size={17} />
                Marcar todos presentes
              </button>
            ) : null}
          </header>
          <div className="mobile-call-list">
            {call.participants.map((person) => (
              <article key={String(person.person_id)}>
                <span>
                  <strong>{String(person.full_name)}</strong>
                  <small>
                    #{String(person.member_number || "").padStart(6, "0")}
                  </small>
                </span>
                <div>
                  {[
                    ["PRESENTE", "Presente"],
                    ["AUSENTE", "Falta"],
                    ["JUSTIFICADO", "Justificado"],
                  ].map(([value, text]) => (
                    <button
                      type="button"
                      disabled={!editable}
                      key={value}
                      className={
                        marks[Number(person.person_id)] === value
                          ? `active ${value.toLowerCase()}`
                          : ""
                      }
                      onClick={() =>
                        setMarks((current) => ({
                          ...current,
                          [Number(person.person_id)]: value,
                        }))
                      }
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setCall(null)}
            >
              Fechar
            </button>
            {editable ? (
              <>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void operation({
                      action: "saveActivityAttendance",
                      activityId: call.activity.id,
                      records,
                    })
                  }
                >
                  Salvar rascunho
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      (await operation({
                        action: "saveActivityAttendance",
                        activityId: call.activity.id,
                        records,
                      })) &&
                      (await operation({
                        action: "finalizeActivity",
                        activityId: call.activity.id,
                      }))
                    )
                      setCall(null);
                  }}
                >
                  Finalizar chamada
                </button>
              </>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function Communication({
  overview,
  busy,
  canManage,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  canManage: boolean;
  operation: (
    p: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
}) {
  const [message, setMessage] = useState(""),
    [audience, setAudience] = useState("PARTICIPANTES_ATIVOS"),
    [contacts, setContacts] = useState<
      Array<{ full_name: string; phone: string }>
    >([]);
  return (
    <section className="content-card department-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Sem credenciais de WhatsApp</p>
          <h2>Comunicação</h2>
        </div>
      </div>
      <form
        className="department-communication"
        onSubmit={async (e) => {
          e.preventDefault();
          const result = (await operation({
            action: "communication",
            message,
            audience,
          })) as {
            contacts?: Array<{ full_name: string; phone: string }>;
          } | null;
          if (result?.contacts) setContacts(result.contacts);
        }}
      >
        <Field label="Público">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="PARTICIPANTES_ATIVOS">Participantes ativos</option>
            <option value="LIDERANCA">Somente liderança</option>
            <option value="ALUNOS_EBD">Alunos ativos da EBD</option>
          </select>
        </Field>
        <Field label="Mensagem">
          <textarea
            rows={5}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Olá! Este é um aviso do ${overview.department.name}.`}
          />
        </Field>
        {canManage ? <Submit busy={busy}>Preparar destinatários</Submit> : null}
      </form>
      {contacts.length ? (
        <div className="communication-result">
          <button
            className="secondary-button compact-button"
            onClick={() =>
              void navigator.clipboard.writeText(
                `${message}\n\n${contacts.map((c) => `${c.full_name}: ${c.phone}`).join("\n")}`,
              )
            }
          >
            <Copy size={16} />
            Copiar mensagem e lista
          </button>
          <p>{contacts.length} destinatários com contato disponível.</p>
        </div>
      ) : null}
    </section>
  );
}

function Access({
  overview,
  busy,
  canManage,
  memberships,
  searchOptions,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  canManage: boolean;
  memberships: Option[];
  searchOptions: (q?: string) => Promise<void>;
  operation: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false),
    [roleOpen, setRoleOpen] = useState(false),
    [membershipId, setMembershipId] = useState(""),
    [roleId, setRoleId] = useState(""),
    [permissions, setPermissions] = useState<string[]>([
      "DEPARTAMENTO_VISUALIZAR",
    ]),
    [role, setRole] = useState({ name: "", isLeadership: true });
  return (
    <section className="content-card department-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Sem login compartilhado</p>
          <h2>Liderança e acessos individuais</h2>
        </div>
        {canManage ? (
          <div className="header-action-group">
            <button
              className="secondary-button compact-button"
              onClick={() => setRoleOpen(true)}
            >
              <Plus size={16} />
              Função
            </button>
            <button
              className="primary-button compact-button"
              onClick={() => {
                setOpen(true);
                void searchOptions("");
              }}
            >
              <ShieldCheck size={17} />
              Conceder acesso
            </button>
          </div>
        ) : null}
      </div>
      <div className="department-access-grid">
        {overview.access.map((access) => (
          <article key={String(access.membership_id)}>
            <ShieldCheck />
            <span>
              <strong>{String(access.display_name)}</strong>
              <small>
                {String(access.department_role || access.role_name)} ·{" "}
                {(access.permissions as string[]).length} permissões
              </small>
            </span>
            <StatusBadge status={String(access.status)} />
          </article>
        ))}
      </div>
      {open ? (
        <Modal
          title="Acesso ao departamento"
          onClose={() => setOpen(false)}
          wide
        >
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await operation({
                  action: "grantAccess",
                  membershipId: Number(membershipId),
                  roleId: Number(roleId) || null,
                  permissions,
                })
              )
                setOpen(false);
            }}
          >
            <Field label="Pesquisar usuário">
              <input
                onChange={(e) => void searchOptions(e.target.value)}
                placeholder="Digite o nome"
              />
            </Field>
            <div className="form-grid">
              <Field label="Usuário">
                <select
                  required
                  value={membershipId}
                  onChange={(e) => setMembershipId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {memberships.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name} · {m.role_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Função interna">
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value="">Sem função</option>
                  {overview.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <fieldset className="department-permissions">
              <legend>Permissões somente neste departamento</legend>
              {DEPARTMENT_LOCAL_PERMISSIONS.map((permission) => (
                <label key={permission}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission)}
                    onChange={(e) =>
                      setPermissions(
                        e.target.checked
                          ? [...permissions, permission]
                          : permissions.filter((p) => p !== permission),
                      )
                    }
                  />
                  <span>{label(permission)}</span>
                </label>
              ))}
            </fieldset>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Salvar acesso</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
      {roleOpen ? (
        <Modal
          title="Nova função departamental"
          onClose={() => setRoleOpen(false)}
        >
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await operation({ action: "createRole", ...role }))
                setRoleOpen(false);
            }}
          >
            <Field label="Nome da função">
              <input
                required
                value={role.name}
                onChange={(e) => setRole({ ...role, name: e.target.value })}
              />
            </Field>
            <label className="check-option">
              <input
                type="checkbox"
                checked={role.isLeadership}
                onChange={(e) =>
                  setRole({ ...role, isLeadership: e.target.checked })
                }
              />
              Função de liderança
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setRoleOpen(false)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Criar função</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function EbdManagement({
  overview,
  busy,
  canClasses,
  canStudents,
  people,
  memberships,
  searchOptions,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  canClasses: boolean;
  canStudents: boolean;
  people: Option[];
  memberships: Option[];
  searchOptions: (q?: string) => Promise<void>;
  operation: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [dialog, setDialog] = useState<
      "class" | "teacher" | "student" | "meeting" | "link" | null
    >(null),
    [mode, setMode] = useState<"linked" | "independent">("linked"),
    [linkStudentId, setLinkStudentId] = useState(0),
    [linkFilter, setLinkFilter] = useState("TODOS"),
    [form, setForm] = useState({
      name: "",
      description: "",
      ageRange: "",
      room: "",
      classId: "",
      membershipId: "",
      personId: "",
      teacherRole: "PRINCIPAL",
      meetingDate: new Date().toISOString().slice(0, 10),
      theme: "",
      startTime: "09:00",
      fullName: "",
      birthDate: "",
      sex: "NAO_INFORMADO",
      cpf: "",
      phone: "",
      whatsapp: "",
      guardianName: "",
      guardianPhone: "",
      notes: "",
      enrolledAt: new Date().toISOString().slice(0, 10),
    });
  const visibleStudents = overview.students.filter(
    (student) =>
      linkFilter === "TODOS" ||
      (linkFilter === "VINCULADOS"
        ? Boolean(student.person_id)
        : !student.person_id),
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    let payload: Record<string, unknown>;
    if (dialog === "student")
      payload =
        mode === "linked"
          ? {
              action: "enrollStudent",
              classId: Number(form.classId),
              personId: Number(form.personId),
              enrolledAt: form.enrolledAt,
            }
          : {
              action: "createIndependentStudent",
              ...form,
              classId: Number(form.classId),
            };
    else
      payload = {
        action:
          dialog === "class"
            ? "createClass"
            : dialog === "teacher"
              ? "assignTeacher"
              : "createMeeting",
        ...form,
        classId: Number(form.classId),
        membershipId: Number(form.membershipId),
      };
    if (await operation(payload)) setDialog(null);
  }
  return (
    <>
      <section className="department-kpis">
        <article>
          <GraduationCap />
          <span>
            <strong>{Number(overview.dashboard.classes || 0)}</strong>Classes
            ativas
          </span>
        </article>
        <article>
          <Users />
          <span>
            <strong>{Number(overview.dashboard.enrolled || 0)}</strong>Alunos
            matriculados
          </span>
        </article>
        <article>
          <ClipboardCheck />
          <span>
            <strong>
              {Number(overview.dashboard.frequency_average || 0).toFixed(1)}%
            </strong>
            Frequência média
          </span>
        </article>
        <article>
          <Megaphone />
          <span>
            <strong>{money(overview.dashboard.last_offering)}</strong>Última
            oferta
          </span>
        </article>
      </section>
      <section className="content-card department-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Gestão da EBD</p>
            <h2>Classes, professores e alunos</h2>
          </div>
          <div className="header-action-group">
            {canClasses ? (
              <>
                <button
                  className="secondary-button compact-button"
                  onClick={() => setDialog("teacher")}
                >
                  <Plus size={16} />
                  Professor
                </button>
                <button
                  className="primary-button compact-button"
                  onClick={() => setDialog("class")}
                >
                  <Plus size={16} />
                  Classe
                </button>
                <button
                  className="secondary-button compact-button"
                  onClick={() => setDialog("meeting")}
                >
                  <CalendarDays size={16} />
                  Encontro
                </button>
              </>
            ) : null}
            {canStudents ? (
              <button
                className="primary-button compact-button"
                onClick={() => {
                  setDialog("student");
                  setMode("linked");
                  void searchOptions("");
                }}
              >
                <Users size={16} />
                Adicionar aluno
              </button>
            ) : null}
          </div>
        </div>
        <div className="ebd-class-grid">
          {overview.classes.map((item) => (
            <article key={String(item.id)}>
              <span className="ebd-class-icon">
                <BookOpen />
              </span>
              <div>
                <strong>{String(item.name)}</strong>
                <small>
                  {String(item.age_range || "Faixa livre")} ·{" "}
                  {String(item.room || "Sala não informada")}
                </small>
                <p>{String(item.teacher_names || "Sem professor vinculado")}</p>
              </div>
              <b>{String(item.student_count || 0)} alunos</b>
            </article>
          ))}
        </div>
      </section>
      <section className="content-card department-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Cadastro integrado</p>
            <h2>Alunos da EBD</h2>
          </div>
          <Field label="Vínculo com Pessoas">
            <select
              value={linkFilter}
              onChange={(event) => setLinkFilter(event.target.value)}
            >
              <option value="TODOS">Todos</option>
              <option value="VINCULADOS">Vinculados</option>
              <option value="INDEPENDENTES">Somente EBD</option>
            </select>
          </Field>
        </div>
        <div className="department-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Classe</th>
                <th>Vínculo</th>
                <th>Contato</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={String(student.student_id)}>
                  <td>
                    <strong>{String(student.full_name)}</strong>
                    {student.guardian_name ? (
                      <small>
                        Responsável: {String(student.guardian_name)}
                      </small>
                    ) : null}
                  </td>
                  <td>{String(student.class_name || "Sem matrícula ativa")}</td>
                  <td>
                    <StatusBadge
                      status={student.person_id ? "VINCULADO" : "SOMENTE EBD"}
                    />
                  </td>
                  <td>
                    {String(
                      student.whatsapp ||
                        student.phone ||
                        student.guardian_phone ||
                        "—",
                    )}
                  </td>
                  <td>
                    {!student.person_id && canStudents ? (
                      <div className="header-action-group">
                        <button
                          className="secondary-button compact-button"
                          onClick={() => {
                            setLinkStudentId(Number(student.student_id));
                            setDialog("link");
                            void searchOptions(String(student.full_name));
                          }}
                        >
                          Vincular pessoa
                        </button>
                        <button
                          className="secondary-button compact-button"
                          disabled={busy}
                          onClick={() =>
                            void operation({
                              action: "createPersonFromStudent",
                              studentId: student.student_id,
                            })
                          }
                        >
                          Cadastrar como Pessoa
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleStudents.length ? (
            <p className="department-inline-empty">
              Nenhum aluno neste filtro.
            </p>
          ) : null}
        </div>
      </section>
      {dialog && dialog !== "link" ? (
        <Modal
          title={
            {
              class: "Nova classe",
              teacher: "Vincular professor",
              student: "Adicionar aluno",
              meeting: "Novo encontro da EBD",
            }[dialog]
          }
          onClose={() => setDialog(null)}
          wide={dialog === "student"}
        >
          <form className="admin-form" onSubmit={submit}>
            {dialog === "student" ? (
              <>
                <div className="student-mode-grid">
                  <button
                    type="button"
                    className={mode === "linked" ? "active" : ""}
                    onClick={() => setMode("linked")}
                  >
                    <Users />
                    <strong>Vincular pessoa já cadastrada</strong>
                    <span>
                      Recomendado — integra membros, departamentos e outros
                      módulos.
                    </span>
                  </button>
                  <button
                    type="button"
                    className={mode === "independent" ? "active" : ""}
                    onClick={() => setMode("independent")}
                  >
                    <GraduationCap />
                    <strong>Cadastrar aluno somente na EBD</strong>
                    <span>
                      Para crianças, visitantes e pessoas ainda não cadastradas.
                    </span>
                  </button>
                </div>
                <ClassSelect
                  overview={overview}
                  value={form.classId}
                  onChange={(value) => setForm({ ...form, classId: value })}
                />
                {mode === "linked" ? (
                  <>
                    <Field label="Pesquisar pessoa por nome, código, CPF ou telefone">
                      <input
                        onChange={(event) =>
                          void searchOptions(event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Pessoa">
                      <select
                        required
                        value={form.personId}
                        onChange={(event) =>
                          setForm({ ...form, personId: event.target.value })
                        }
                      >
                        <option value="">Selecione</option>
                        {people.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.full_name} · #
                            {String(item.member_number || "").padStart(6, "0")}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Nome completo">
                      <input
                        required
                        value={form.fullName}
                        onChange={(event) => {
                          setForm({ ...form, fullName: event.target.value });
                          if (event.target.value.length >= 3)
                            void searchOptions(event.target.value);
                        }}
                      />
                    </Field>
                    {people.length && form.fullName.length >= 3 ? (
                      <div className="similarity-warning">
                        <strong>Encontramos possíveis correspondências</strong>
                        {people.slice(0, 3).map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                              setMode("linked");
                              setForm({ ...form, personId: String(item.id) });
                            }}
                          >
                            {item.full_name} — membro #
                            {String(item.member_number || "").padStart(6, "0")}{" "}
                            · Vincular pessoa existente
                          </button>
                        ))}
                        <span>Você também pode continuar sem vínculo.</span>
                      </div>
                    ) : null}
                    <div className="form-grid">
                      <Field label="Nascimento (opcional)">
                        <input
                          type="date"
                          value={form.birthDate}
                          onChange={(event) =>
                            setForm({ ...form, birthDate: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Sexo">
                        <select
                          value={form.sex}
                          onChange={(event) =>
                            setForm({ ...form, sex: event.target.value })
                          }
                        >
                          <option value="NAO_INFORMADO">Não informado</option>
                          <option value="MASCULINO">Masculino</option>
                          <option value="FEMININO">Feminino</option>
                        </select>
                      </Field>
                      <Field label="CPF (opcional)">
                        <input
                          inputMode="numeric"
                          value={form.cpf}
                          onChange={(event) => {
                            setForm({ ...form, cpf: event.target.value });
                            if (event.target.value.replace(/\D/g, "").length >= 5)
                              void searchOptions(event.target.value);
                          }}
                        />
                      </Field>
                      <Field label="Telefone">
                        <input
                          value={form.phone}
                          onChange={(event) =>
                            setForm({ ...form, phone: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="WhatsApp">
                        <input
                          value={form.whatsapp}
                          onChange={(event) =>
                            setForm({ ...form, whatsapp: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Responsável">
                        <input
                          value={form.guardianName}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              guardianName: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Telefone do responsável">
                        <input
                          value={form.guardianPhone}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              guardianPhone: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Observação">
                      <textarea
                        value={form.notes}
                        onChange={(event) =>
                          setForm({ ...form, notes: event.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
                <Field label="Data de matrícula">
                  <input
                    type="date"
                    value={form.enrolledAt}
                    onChange={(event) =>
                      setForm({ ...form, enrolledAt: event.target.value })
                    }
                  />
                </Field>
              </>
            ) : null}
            {dialog === "class" ? (
              <>
                <Field label="Nome da classe">
                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Faixa etária">
                    <input
                      value={form.ageRange}
                      onChange={(event) =>
                        setForm({ ...form, ageRange: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Sala / local">
                    <input
                      value={form.room}
                      onChange={(event) =>
                        setForm({ ...form, room: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Descrição">
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                  />
                </Field>
              </>
            ) : null}
            {dialog === "teacher" ? (
              <>
                <Field label="Pesquisar usuário">
                  <input
                    onChange={(event) => void searchOptions(event.target.value)}
                  />
                </Field>
                <Field label="Classe">
                  <ClassSelect
                    overview={overview}
                    value={form.classId}
                    onChange={(value) => setForm({ ...form, classId: value })}
                  />
                </Field>
                <Field label="Professor">
                  <select
                    required
                    value={form.membershipId}
                    onChange={(event) =>
                      setForm({ ...form, membershipId: event.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {memberships.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Atuação">
                  <select
                    value={form.teacherRole}
                    onChange={(event) =>
                      setForm({ ...form, teacherRole: event.target.value })
                    }
                  >
                    <option value="PRINCIPAL">Professor principal</option>
                    <option value="AUXILIAR">Auxiliar</option>
                    <option value="SUBSTITUTO">Substituto</option>
                  </select>
                </Field>
              </>
            ) : null}
            {dialog === "meeting" ? (
              <>
                <Field label="Data">
                  <input
                    type="date"
                    required
                    value={form.meetingDate}
                    onChange={(event) =>
                      setForm({ ...form, meetingDate: event.target.value })
                    }
                  />
                </Field>
                <Field label="Horário">
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm({ ...form, startTime: event.target.value })
                    }
                  />
                </Field>
                <Field label="Tema da aula">
                  <input
                    value={form.theme}
                    onChange={(event) =>
                      setForm({ ...form, theme: event.target.value })
                    }
                  />
                </Field>
              </>
            ) : null}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Salvar</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
      {dialog === "link" ? (
        <Modal
          title="Vincular aluno a uma Pessoa"
          onClose={() => setDialog(null)}
        >
          <form
            className="admin-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await operation({
                  action: "linkStudent",
                  studentId: linkStudentId,
                  personId: Number(form.personId),
                })
              )
                setDialog(null);
            }}
          >
            <Field label="Pesquisar pessoa">
              <input
                onChange={(event) => void searchOptions(event.target.value)}
              />
            </Field>
            <Field label="Pessoa existente">
              <select
                required
                value={form.personId}
                onChange={(event) =>
                  setForm({ ...form, personId: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {people.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} · #
                    {String(item.member_number || "").padStart(6, "0")}
                  </option>
                ))}
              </select>
            </Field>
            <p className="department-inline-note">
              O vínculo não cria outro aluno e preserva toda a matrícula e
              frequência.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDialog(null)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Vincular pessoa existente</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
function ClassSelect({
  overview,
  value,
  onChange,
}: {
  overview: DepartmentOverview;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione</option>
      {overview.classes
        .filter((c) => String(c.status) === "ATIVO")
        .map((c) => (
          <option key={String(c.id)} value={String(c.id)}>
            {String(c.name)}
          </option>
        ))}
    </select>
  );
}

function EbdAttendance({
  overview,
  busy,
  meeting,
  meetingId,
  classId,
  attendance,
  activeClass,
  setAttendance,
  openMeeting,
  operation,
}: {
  overview: DepartmentOverview;
  busy: boolean;
  meeting: MeetingData | null;
  meetingId: number;
  classId: number;
  attendance: Record<number, string>;
  activeClass: Record<string, unknown> | undefined;
  setAttendance: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  openMeeting: (m: number, c?: number) => Promise<void>;
  operation: (
    p: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | null>;
}) {
  const [summary, setSummary] = useState({
      bibleCount: "0",
      assistanceCount: "0",
      offering: "0",
      notes: "",
      reason: "",
    }),
    [visitorOpen, setVisitorOpen] = useState(false),
    [visitor, setVisitor] = useState({
      name: "",
      phone: "",
      ageRange: "",
      invitedBy: "",
    }),
    [reading, setReading] = useState(false);
  const records = Object.entries(attendance).map(([studentId, status]) => ({
    studentId: Number(studentId),
    status,
  }));
  const closure = meeting?.closure;
  return (
    <>
      <section className="content-card department-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Celular e Secretaria</p>
            <h2>Chamada da EBD</h2>
          </div>
          <button
            className="secondary-button compact-button"
            onClick={() => meetingId && void openMeeting(meetingId, classId)}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
        <div className="ebd-meeting-picker">
          <Field label="Encontro">
            <select
              value={meetingId || ""}
              onChange={(e) => void openMeeting(Number(e.target.value), 0)}
            >
              <option value="">Selecione</option>
              {overview.meetings.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {date(m.meeting_date)} · {String(m.theme || "EBD")}
                </option>
              ))}
            </select>
          </Field>
          {meeting ? (
            <Field label="Classe">
              <select
                value={classId || ""}
                onChange={(e) =>
                  void openMeeting(meetingId, Number(e.target.value))
                }
              >
                <option value="">Acompanhamento geral</option>
                {meeting.classes.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.name)} · {String(c.summary_status)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
        {meeting && !classId ? (
          <Secretariat
            meeting={meeting}
            operation={operation}
            meetingId={meetingId}
            onReading={() => setReading(true)}
          />
        ) : null}
        {meeting && classId ? (
          <>
            <header className="call-mobile-header">
              <div>
                <strong>{String(activeClass?.name)}</strong>
                <span>{meeting.students.length} alunos ativos</span>
              </div>
              <button
                onClick={() =>
                  setAttendance(
                    Object.fromEntries(
                      meeting.students.map((student) => [
                        Number(student.student_id),
                        "PRESENTE",
                      ]),
                    ),
                  )
                }
              >
                <Check size={17} />
                Marcar todos presentes
              </button>
            </header>
            <div className="mobile-call-list">
              {meeting.students.map((student) => (
                <article key={String(student.student_id)}>
                  <span>
                    <strong>{String(student.full_name)}</strong>
                    <small>
                      #{String(student.member_number || "").padStart(6, "0")}
                    </small>
                  </span>
                  <div>
                    {[
                      ["PRESENTE", "Presente"],
                      ["AUSENTE", "Falta"],
                      ["JUSTIFICADO", "Justificado"],
                    ].map(([value, text]) => (
                      <button
                        key={value}
                        className={
                          attendance[Number(student.student_id)] === value
                            ? `active ${value.toLowerCase()}`
                            : ""
                        }
                        onClick={() =>
                          setAttendance((current) => ({
                            ...current,
                            [Number(student.student_id)]: value,
                          }))
                        }
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="call-actions">
              <button
                className="secondary-button compact-button"
                disabled={busy}
                onClick={() =>
                  void operation({
                    action: "saveClassAttendance",
                    meetingId,
                    classId,
                    records,
                  })
                }
              >
                Salvar rascunho
              </button>
              <button
                className="secondary-button compact-button"
                onClick={() => setVisitorOpen(true)}
              >
                <Plus size={16} />
                Visitante
              </button>
            </div>
            <section className="class-summary-form">
              <h3>Resumo da classe</h3>
              <div className="form-grid">
                <Field label="Bíblias">
                  <input
                    type="number"
                    min="0"
                    value={summary.bibleCount}
                    onChange={(e) =>
                      setSummary({ ...summary, bibleCount: e.target.value })
                    }
                  />
                </Field>
                <Field label="Assistências">
                  <input
                    type="number"
                    min="0"
                    value={summary.assistanceCount}
                    onChange={(e) =>
                      setSummary({
                        ...summary,
                        assistanceCount: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Oferta (R$)">
                  <input
                    inputMode="decimal"
                    value={summary.offering}
                    onChange={(e) =>
                      setSummary({ ...summary, offering: e.target.value })
                    }
                  />
                </Field>
                <Field label="Observação">
                  <input
                    value={summary.notes}
                    onChange={(e) =>
                      setSummary({ ...summary, notes: e.target.value })
                    }
                  />
                </Field>
              </div>
              <button
                className="primary-button mobile-finalize-button"
                disabled={busy}
                onClick={async () => {
                  const saved = await operation({
                    action: "saveClassAttendance",
                    meetingId,
                    classId,
                    records,
                  });
                  if (saved)
                    await operation({
                      action: "finalizeClass",
                      meetingId,
                      classId,
                      version: Number(activeClass?.summary_version || 1),
                      bibleCount: Number(summary.bibleCount),
                      assistanceCount: Number(summary.assistanceCount),
                      offeringCents: Math.round(
                        Number(summary.offering.replace(",", ".")) * 100,
                      ),
                      notes: summary.notes,
                      reason: summary.reason,
                    });
                }}
              >
                Revisar e finalizar chamada
              </button>
            </section>
          </>
        ) : null}
      </section>
      {visitorOpen ? (
        <Modal
          title="Adicionar visitante"
          onClose={() => setVisitorOpen(false)}
        >
          <form
            className="admin-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await operation({
                  action: "addVisitor",
                  meetingId,
                  classId,
                  ...visitor,
                })
              )
                setVisitorOpen(false);
            }}
          >
            <Field label="Nome">
              <input
                required
                value={visitor.name}
                onChange={(e) =>
                  setVisitor({ ...visitor, name: e.target.value })
                }
              />
            </Field>
            <Field label="Telefone (opcional)">
              <input
                value={visitor.phone}
                onChange={(e) =>
                  setVisitor({ ...visitor, phone: e.target.value })
                }
              />
            </Field>
            <Field label="Faixa etária">
              <input
                value={visitor.ageRange}
                onChange={(e) =>
                  setVisitor({ ...visitor, ageRange: e.target.value })
                }
              />
            </Field>
            <Field label="Quem convidou">
              <input
                value={visitor.invitedBy}
                onChange={(e) =>
                  setVisitor({ ...visitor, invitedBy: e.target.value })
                }
              />
            </Field>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setVisitorOpen(false)}
              >
                Cancelar
              </button>
              <Submit busy={busy}>Adicionar visitante</Submit>
            </div>
          </form>
        </Modal>
      ) : null}
      {reading && closure ? (
        <Reading
          closure={closure}
          meeting={meeting!.meeting}
          onClose={() => setReading(false)}
        />
      ) : null}
    </>
  );
}

function Secretariat({
  meeting,
  operation,
  meetingId,
  onReading,
}: {
  meeting: MeetingData;
  operation: (p: Record<string, unknown>) => Promise<unknown>;
  meetingId: number;
  onReading: () => void;
}) {
  const pending = meeting.classes.filter(
    (c) => String(c.summary_status) !== "FINALIZADA",
  );
  return (
    <>
      <div className="secretariat-grid">
        {meeting.classes.map((c) => (
          <article key={String(c.id)}>
            <span>
              <strong>{String(c.name)}</strong>
              <small>
                {String(c.enrolled_count || 0)} matriculados ·{" "}
                {String(c.present_count || 0)} presentes
              </small>
            </span>
            <StatusBadge status={String(c.summary_status)} />
          </article>
        ))}
      </div>
      <div className="closure-actions">
        {meeting.closure ? (
          <>
            <button
              className="primary-button compact-button"
              onClick={onReading}
            >
              <BookOpen size={17} />
              Modo de leitura
            </button>
            <strong>
              Oferta geral: {money(meeting.closure.offering_total_cents)}
            </strong>
          </>
        ) : (
          <button
            className="primary-button compact-button"
            onClick={() =>
              void operation({
                action: "closeMeeting",
                meetingId,
                exceptionReason: pending.length
                  ? window.prompt(
                      `Existem ${pending.length} classes pendentes. Informe o motivo para fechar mesmo assim:`,
                    ) || ""
                  : "",
              })
            }
          >
            Finalizar EBD{" "}
            {pending.length ? `(${pending.length} pendentes)` : ""}
          </button>
        )}
      </div>
    </>
  );
}
function Reading({
  closure,
  meeting,
  onClose,
}: {
  closure: Record<string, unknown>;
  meeting: Record<string, unknown>;
  onClose: () => void;
}) {
  return (
    <div className="ebd-reading-mode">
      <button onClick={onClose}>
        <X />
        Fechar
      </button>
      <div>
        <GraduationCap />
        <p>Escola Bíblica Dominical</p>
        <h1>{date(meeting.meeting_date)}</h1>
        <section>
          {[
            ["Matriculados", closure.enrolled_total],
            ["Presentes", closure.present_total],
            ["Ausentes", closure.absent_total],
            ["Justificados", closure.justified_total],
            ["Visitantes", closure.visitor_total],
            ["Bíblias", closure.bible_total],
            ["Assistências", closure.assistance_total],
          ].map(([name, value]) => (
            <article key={String(name)}>
              <span>{String(name)}</span>
              <strong>{String(value)}</strong>
            </article>
          ))}
          <article className="reading-offering">
            <span>Oferta geral</span>
            <strong>{money(closure.offering_total_cents)}</strong>
          </article>
        </section>
      </div>
    </div>
  );
}
function Reports({
  overview,
  report,
  setReport,
}: {
  overview: DepartmentOverview;
  report: Record<string, unknown> | null;
  setReport: (value: Record<string, unknown> | null) => void;
}) {
  const [from, setFrom] = useState(
      new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const body = await readApi<{ result: Record<string, unknown> }>(
        await fetch(
          `/api/departments/${overview.department.id}/reports?kind=ebd&from=${from}&to=${to}`,
          { cache: "no-store" },
        ),
      );
      setReport(body.result);
    } finally {
      setLoading(false);
    }
  }
  const students = (report?.students ?? []) as Array<Record<string, unknown>>,
    closures = (report?.closures ?? []) as Array<Record<string, unknown>>,
    alerts = (report?.absenceAlerts ?? []) as Array<Record<string, unknown>>,
    unlinked = (report?.unlinkedStudents ?? []) as Array<
      Record<string, unknown>
    >;
  return (
    <section className="content-card department-section">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow">Período e histórico</p>
          <h2>Relatórios da EBD</h2>
        </div>
      </div>
      <div className="report-filters">
        <Field label="De">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <button
          className="primary-button compact-button"
          onClick={() => void load()}
        >
          {loading ? <LoaderCircle className="spin" /> : <Search />}Gerar
          relatório
        </button>
      </div>
      {report ? (
        <>
          <section className="department-kpis compact">
            <article>
              <CalendarDays />
              <span>
                <strong>{closures.length}</strong>Encontros fechados
              </span>
            </article>
            <article>
              <Users />
              <span>
                <strong>{students.length}</strong>Alunos no período
              </span>
            </article>
            <article>
              <Megaphone />
              <span>
                <strong>
                  {money(
                    closures.reduce(
                      (sum, row) => sum + Number(row.offering_total_cents || 0),
                      0,
                    ),
                  )}
                </strong>
                Ofertas registradas
              </span>
            </article>
          </section>
          {alerts.length ? (
            <section className="absence-alerts">
              <h3>Alertas de faltas consecutivas</h3>
              <div className="department-event-list">
                {alerts.map((alert) => (
                  <article key={String(alert.personId)}>
                    <Megaphone />
                    <span>
                      <strong>{String(alert.fullName)}</strong>
                      <small>
                        {String(alert.className)} · {String(alert.consecutive)}{" "}
                        faltas consecutivas
                      </small>
                    </span>
                    <StatusBadge status="ATENCAO" />
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {unlinked.length ? (
            <section className="absence-alerts">
              <h3>Alunos somente na EBD, ainda sem vínculo com Pessoa</h3>
              <div className="department-event-list">
                {unlinked.map((student) => (
                  <article key={String(student.id)}>
                    <Users />
                    <span>
                      <strong>{String(student.full_name)}</strong>
                      <small>
                        {String(student.class_name || "Sem classe ativa")}
                        {student.guardian_name
                          ? ` · Responsável: ${String(student.guardian_name)}`
                          : ""}
                      </small>
                    </span>
                    <StatusBadge status="SOMENTE_EBD" />
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <div className="department-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Classe</th>
                  <th>Encontros</th>
                  <th>Presentes</th>
                  <th>Faltas</th>
                  <th>Justificados</th>
                  <th>Frequência</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={`${student.id}-${student.class_name}`}>
                    <td>{String(student.full_name)}</td>
                    <td>{String(student.class_name)}</td>
                    <td>{String(student.encounters)}</td>
                    <td>{String(student.present || 0)}</td>
                    <td>{String(student.absent || 0)}</td>
                    <td>{String(student.justified || 0)}</td>
                    <td>
                      <strong>{String(student.frequency || 0)}%</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="department-inline-empty">
          Escolha o período e gere o relatório.
        </p>
      )}
    </section>
  );
}

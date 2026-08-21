"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Scale,
  Send,
  X,
} from "lucide-react";
import { readApi, StatusBadge, Toast } from "@/components/admin/admin-ui";

type Row = Record<string, unknown>;
type Data = { repasses: Row[]; accounts: Row[] };
type Action = "SEND" | "RECEIVE" | "WRITE_OFF";
const money = (value: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value || 0) / 100,
  );
const label = (value: unknown) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLocaleLowerCase("pt-BR")
    .replace(/^./, (letter) => letter.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);
const cents = (value: FormDataEntryValue | null) =>
  Math.round(
    (Number(
      String(value || "0")
        .replaceAll(".", "")
        .replace(",", "."),
    ) || 0) * 100,
  );

export function FinanceRepassesManager() {
  const [data, setData] = useState<Data>({ repasses: [], accounts: [] }),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("PENDENTES"),
    [selected, setSelected] = useState<Row | null>(null),
    [action, setAction] = useState<Action | null>(null),
    [toast, setToast] = useState({
      message: "",
      kind: "success" as "success" | "error",
    });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await readApi<{ result: Data }>(
        await fetch("/api/finance/repasses", { cache: "no-store" }),
      );
      setData(body.result);
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os repasses.",
        kind: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const rows = useMemo(
    () =>
      data.repasses.filter((row) =>
        filter === "TODOS"
          ? true
          : filter === "CONCLUIDOS"
            ? row.status === "QUITADO"
            : !["QUITADO", "SUBSTITUIDO"].includes(String(row.status)),
      ),
    [data.repasses, filter],
  );
  const totals = useMemo(
    () =>
      data.repasses
        .filter((row) => row.status !== "SUBSTITUIDO")
        .reduce<{ expected: number; received: number; pending: number }>(
          (sum, row) => ({
            expected: sum.expected + Number(row.expected_cents || 0),
            received: sum.received + Number(row.received_cents || 0),
            pending: sum.pending + Number(row.pending_cents || 0),
          }),
          { expected: 0, received: 0, pending: 0 },
        ),
    [data.repasses],
  );
  function open(nextAction: Action, row: Row) {
    setSelected(row);
    setAction(nextAction);
  }
  async function submit(form: FormData) {
    if (!selected || !action) return;
    setBusy(true);
    try {
      await readApi(
        await fetch("/api/finance/repasses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            repassId: selected.id,
            accountId: Number(form.get("accountId")) || null,
            amountCents: cents(form.get("amount")),
            occurredOn: form.get("occurredOn"),
            reason: form.get("reason"),
          }),
        }),
      );
      setAction(null);
      setSelected(null);
      setToast({
        message:
          action === "SEND"
            ? "Envio registrado e unidade de destino notificada."
            : action === "RECEIVE"
              ? "Valor recebido confirmado e lançado no Financeiro."
              : "Diferença regularizada com justificativa e auditoria.",
        kind: "success",
      });
      await load();
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o repasse.",
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }
  if (loading && !data.repasses.length)
    return (
      <section className="content-card finance-empty">
        <LoaderCircle className="spin" />
        <h2>Carregando repasses entre unidades...</h2>
      </section>
    );
  return (
    <section className="finance-repasses-space">
      <section className="finance-kpis finance-repass-kpis">
        <article>
          <Send />
          <span>
            Calculado para repasse<strong>{money(totals.expected)}</strong>
          </span>
        </article>
        <article>
          <ArrowDownLeft />
          <span>
            Recebido e confirmado<strong>{money(totals.received)}</strong>
          </span>
        </article>
        <article>
          <Clock3 />
          <span>
            Pendente de solução<strong>{money(totals.pending)}</strong>
          </span>
        </article>
      </section>
      <section className="content-card finance-section">
        <div className="finance-section-head">
          <div>
            <p className="eyebrow">Controle entre unidades</p>
            <h2>Repasses do Rateio</h2>
            <p className="finance-helper">
              O fechamento gera a obrigação. A origem registra o envio e o
              destino confirma somente o valor realmente recebido.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <LoaderCircle className="spin" /> : <RefreshCw />}{" "}
            Atualizar
          </button>
        </div>
        <div className="finance-repass-filters">
          <button
            className={filter === "PENDENTES" ? "active" : ""}
            onClick={() => setFilter("PENDENTES")}
          >
            Pendentes
          </button>
          <button
            className={filter === "CONCLUIDOS" ? "active" : ""}
            onClick={() => setFilter("CONCLUIDOS")}
          >
            Concluídos
          </button>
          <button
            className={filter === "TODOS" ? "active" : ""}
            onClick={() => setFilter("TODOS")}
          >
            Todos
          </button>
        </div>
        <div className="finance-repass-list">
          {rows.length ? (
            rows.map((row) => (
              <article
                key={String(row.id)}
                className={`finance-repass-card ${String(row.status).toLowerCase()}`}
              >
                <header>
                  <div>
                    <p className="eyebrow">
                      Caixa{" "}
                      {String(row.competency).split("-").reverse().join("/")} ·
                      fechamento v{String(row.closure_version)}
                    </p>
                    <h3>
                      {String(row.payer_unit_name)} <span>→</span>{" "}
                      {String(row.receiver_unit_name)}
                    </h3>
                    <small>
                      {String(row.recipient_name)}
                      {row.destination_department_name
                        ? ` · ${String(row.destination_department_name)}`
                        : ""}
                      {row.kind !== "NORMAL" ? ` · ${label(row.kind)}` : ""}
                    </small>
                  </div>
                  <StatusBadge status={String(row.status)} />
                </header>
                <div className="finance-repass-values">
                  <span>
                    Previsto<strong>{money(row.expected_cents)}</strong>
                  </span>
                  <span>
                    Enviado<strong>{money(row.sent_cents)}</strong>
                  </span>
                  <span>
                    Recebido<strong>{money(row.received_cents)}</strong>
                  </span>
                  <span>
                    Regularizado<strong>{money(row.written_off_cents)}</strong>
                  </span>
                  <span>
                    Pendente<strong>{money(row.pending_cents)}</strong>
                  </span>
                </div>
                {Number(row.in_transit_cents) > 0 ? (
                  <p className="finance-warning">
                    <AlertTriangle /> {money(row.in_transit_cents)} informado
                    como enviado ainda não foi confirmado pelo destino.
                  </p>
                ) : null}
                <div className="finance-repass-actions">
                  {row.canSend ? (
                    <button
                      className="primary-button"
                      onClick={() => open("SEND", row)}
                    >
                      <ArrowUpRight /> Registrar envio
                    </button>
                  ) : null}
                  {row.canReceive ? (
                    <button
                      className="primary-button"
                      onClick={() => open("RECEIVE", row)}
                    >
                      <ArrowDownLeft /> Confirmar recebimento
                    </button>
                  ) : null}
                  {row.canWriteOff ? (
                    <button
                      className="secondary-button"
                      onClick={() => open("WRITE_OFF", row)}
                    >
                      <Scale /> Regularizar diferença
                    </button>
                  ) : null}
                  {row.status === "QUITADO" ? (
                    <span className="finance-repass-ok">
                      <CheckCircle2 /> Repasse concluído
                    </span>
                  ) : null}
                </div>
                {Array.isArray(row.events) && row.events.length ? (
                  <details>
                    <summary>Histórico ({row.events.length})</summary>
                    <div className="finance-repass-history">
                      {(row.events as Row[]).map((event) => (
                        <p key={String(event.id)}>
                          <strong>
                            {label(event.event_type)} ·{" "}
                            {money(event.amount_cents)}
                          </strong>
                          <span>
                            {String(event.actor_name)} ·{" "}
                            {new Date(String(event.created_at)).toLocaleString(
                              "pt-BR",
                            )}
                            {event.account_name
                              ? ` · ${String(event.account_name)}`
                              : ""}
                          </span>
                          {event.reason ? (
                            <small>{String(event.reason)}</small>
                          ) : null}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            ))
          ) : (
            <div className="finance-empty-inline">
              Nenhum repasse nesta situação.
            </div>
          )}
        </div>
      </section>
      {action && selected ? (
        <RepassDialog
          action={action}
          row={selected}
          accounts={data.accounts}
          busy={busy}
          onClose={() => {
            setAction(null);
            setSelected(null);
          }}
          onSubmit={submit}
        />
      ) : null}
      <Toast {...toast} onClose={() => setToast({ ...toast, message: "" })} />
    </section>
  );
}

function RepassDialog({
  action,
  row,
  accounts,
  busy,
  onClose,
  onSubmit,
}: {
  action: Action;
  row: Row;
  accounts: Row[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (form: FormData) => void;
}) {
  const unitId = Number(
      action === "SEND" ? row.payer_unit_id : row.receiver_unit_id,
    ),
    available =
      action === "SEND"
        ? Number(row.expected_cents) -
          Number(row.sent_cents) -
          Number(row.written_off_cents)
        : action === "RECEIVE"
          ? Number(row.sent_cents) - Number(row.received_cents)
          : Number(row.expected_cents) -
            Number(row.sent_cents) -
            Number(row.written_off_cents),
    title =
      action === "SEND"
        ? "Registrar envio"
        : action === "RECEIVE"
          ? "Confirmar recebimento"
          : "Regularizar diferença";
  return (
    <div className="dialog-backdrop">
      <section
        className="dialog-card finance-sensitive-dialog"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <p className="eyebrow">Repasse entre unidades</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        <div className="sensitive-summary">
          <span>
            Origem <strong>{String(row.payer_unit_name)}</strong>
          </span>
          <span>
            Destino <strong>{String(row.receiver_unit_name)}</strong>
          </span>
          <span>
            Disponível nesta etapa <strong>{money(available)}</strong>
          </span>
        </div>
        {action === "RECEIVE" ? (
          <p>
            Informe exatamente o valor que entrou. Se for menor, a diferença
            continuará pendente para nova cobrança ou regularização autorizada.
          </p>
        ) : action === "WRITE_OFF" ? (
          <p>
            Use somente quando a Matriz ou Convenção autorizou que parte do
            valor permanecesse na origem. A justificativa ficará no histórico.
          </p>
        ) : (
          <p>
            Você pode enviar o valor total ou uma parte. O dinheiro só será
            considerado recebido depois da confirmação da unidade de destino.
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(new FormData(event.currentTarget));
          }}
        >
          {action !== "WRITE_OFF" ? (
            <label className="field-group">
              <span>Conta da unidade</span>
              <select name="accountId" required>
                <option value="">Selecione</option>
                {accounts
                  .filter(
                    (account) =>
                      Number(account.unit_id) === unitId &&
                      account.status === "ATIVA",
                  )
                  .map((account) => (
                    <option key={String(account.id)} value={String(account.id)}>
                      {String(account.name)} · {label(account.account_type)}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label className="field-group">
            <span>Valor</span>
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={(available / 100).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              required
            />
          </label>
          <label className="field-group">
            <span>Data</span>
            <input
              name="occurredOn"
              type="date"
              defaultValue={today()}
              required
            />
          </label>
          <label className="field-group">
            <span>
              {action === "WRITE_OFF"
                ? "Justificativa obrigatória"
                : "Observação"}
            </span>
            <textarea
              name="reason"
              minLength={action === "WRITE_OFF" ? 10 : undefined}
              required={action === "WRITE_OFF"}
              rows={3}
            />
          </label>
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" />
              ) : action === "SEND" ? (
                <ArrowUpRight />
              ) : action === "RECEIVE" ? (
                <ArrowDownLeft />
              ) : (
                <Scale />
              )}
              {title}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

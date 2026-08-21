"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Church,
  History,
  HandCoins,
  LoaderCircle,
  MapPin,
  Printer,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import {
  AdminPageHeader,
  readApi,
  StatusBadge,
} from "@/components/admin/admin-ui";
import { useWorkspace } from "@/components/protected-shell";
import type { MemberDetail } from "@/lib/members/types";
import { displayCustomValue } from "@/lib/members/custom-fields";
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${value}T12:00:00Z`),
      )
    : "—";
const label = (v: string | null) =>
  v ? v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
function Field({ name, value }: { name: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === "—")
    return null;
  return (
    <div className="profile-field">
      <span>{name}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function MemberProfile({
  id,
  printMode = false,
}: {
  id: number;
  printMode?: boolean;
}) {
  const { session, hasPermission } = useWorkspace();
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState("");
  const [financial, setFinancial] = useState<{preference:{default_privacy:string};contributions:Array<{id:number;contribution_type:string;privacy:string;amount_cents:number;occurred_on:string;description:string}>}|null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const b = await readApi<{ detail: MemberDetail }>(
          await fetch(
            `/api/admin/members/${id}${printMode ? "?print=1" : ""}`,
            { cache: "no-store" },
          ),
        );
        if (active) setDetail(b.detail);
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar a ficha.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [id, printMode]);
  useEffect(()=>{if(printMode||!hasPermission("FINANCEIRO_CONTRIBUICOES_VISUALIZAR"))return;let active=true;void fetch(`/api/finance/people/${id}`,{cache:"no-store"}).then(response=>readApi<{result:typeof financial}>(response)).then(body=>{if(active)setFinancial(body.result);}).catch(()=>undefined);return()=>{active=false;};},[id,printMode,hasPermission]);
  if (!detail)
    return (
      <section className="content-card table-state">
        <LoaderCircle className="spin" />
        {error || "Carregando ficha do membro..."}
      </section>
    );
  const m = detail.member;
  const printLogoUrl = m.unitLogoUrl ?? session.unitLogoUrl;
  return (
    <div className={printMode ? "member-print-page" : "member-profile-page"}>
      {printMode ? (
        <header className="print-member-header">
          {printLogoUrl ? (
            <img src={printLogoUrl} alt="Logo da unidade" />
          ) : (
            <Church size={52} />
          )}
          <div>
            <strong>{session.activeTenant?.name ?? "NexIgreja"}</strong>
            <span>{m.conventionName}</span>
            <span>
              {m.matrixName}
              {m.branchName ? ` · ${m.branchName}` : ""}
            </span>
            <h1>FICHA DE MEMBRO</h1>
          </div>
        </header>
      ) : (
        <AdminPageHeader
          eyebrow="Ficha individual"
          title={m.fullName}
          description={`Código ${m.memberCode} · ${m.branchName ?? m.matrixName}`}
          action={
            <div className="header-action-group">
              <Link
                className="secondary-button compact-button"
                href="/painel/membros"
              >
                <ArrowLeft size={17} />
                Voltar
              </Link>
              {hasPermission("MEMBROS_IMPRIMIR") ? (
                <Link
                  className="primary-button compact-button"
                  href={`/painel/membros/${id}/imprimir`}
                  target="_blank"
                >
                  <Printer size={17} />
                  Imprimir ficha
                </Link>
              ) : null}
            </div>
          }
        />
      )}
      <section className="content-card member-profile-hero">
        <div className="member-profile-photo">
          {m.photoUrl ? (
            <img src={m.photoUrl} alt={`Foto de ${m.fullName}`} />
          ) : (
            <UserRound size={58} />
          )}
        </div>
        <div>
          <p className="eyebrow">Código {m.memberCode}</p>
          <h2>{m.fullName}</h2>
          <div className="profile-badges">
            <StatusBadge status={m.status} />
            {m.functionName ? <span>{m.functionName}</span> : null}
            <span>{m.branchName ?? m.matrixName}</span>
          </div>
        </div>
        {printMode ? (
          <button
            className="primary-button print-trigger"
            onClick={() => window.print()}
          >
            <Printer size={18} />
            Imprimir
          </button>
        ) : null}
      </section>
      <div className="member-profile-grid">
        <section className="content-card profile-section">
          <h3>Identificação e dados pessoais</h3>
          <div className="profile-fields">
            <Field
              name="Nascimento"
              value={
                m.birthDate
                  ? `${date(m.birthDate)}${m.age !== null ? ` (${m.age} anos)` : ""}`
                  : "—"
              }
            />
            <Field name="Sexo" value={label(m.sex)} />
            <Field
              name="CPF"
              value={
                m.cpf
                  ? m.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                  : "—"
              }
            />
            <Field name="RG" value={m.rg} />
            <Field name="Título de Eleitor" value={m.voterTitle} />
            <Field
              name="Naturalidade"
              value={
                m.birthCity
                  ? [m.birthCity, m.birthState].filter(Boolean).join("/")
                  : "—"
              }
            />
            <Field name="Telefone" value={m.phone} />
            <Field name="WhatsApp" value={m.whatsapp} />
            <Field name="E-mail" value={m.email} />
          </div>
        </section>
        {m.customValues.length ? (
          <section className="content-card profile-section profile-section-wide">
            <h3>Informações adicionais</h3>
            <div className="profile-fields">
              {m.customValues.map((value) => <Field key={value.fieldId} name={value.name} value={displayCustomValue(value.fieldType,value.value)} />)}
            </div>
          </section>
        ) : null}
        <section className="content-card profile-section">
          <h3>Família</h3>
          <div className="profile-fields">
            <Field name="Nome da mãe" value={m.motherName} />
            <Field name="Nome do pai" value={m.fatherName} />
            <Field name="Estado civil" value={label(m.maritalStatus)} />
            <Field name="Cônjuge" value={m.spouseLinkedName ?? m.spouseName} />
            <Field
              name="Quantidade de filhos"
              value={String(m.childrenCount)}
            />
          </div>
        </section>
        <section className="content-card profile-section">
          <h3>
            <MapPin size={18} /> Endereço
          </h3>
          <div className="profile-fields">
            <Field name="CEP" value={m.postalCode} />
            <Field
              name="Logradouro"
              value={[m.street, m.addressNumber].filter(Boolean).join(", ")}
            />
            <Field name="Complemento" value={m.complement} />
            <Field name="Bairro" value={m.district} />
            <Field
              name="Cidade/UF"
              value={m.city ? [m.city, m.state].filter(Boolean).join("/") : "—"}
            />
          </div>
        </section>
        <section className="content-card profile-section">
          <h3>Formação e profissão</h3>
          <div className="profile-fields">
            <Field name="Profissão" value={m.profession} />
            <Field name="Local de trabalho" value={m.workplace} />
            <Field name="Escolaridade" value={label(m.educationLevel)} />
            <Field
              name="Formação teológica"
              value={label(m.theologicalEducation)}
            />
          </div>
        </section>
        <section className="content-card profile-section profile-section-wide">
          <h3>
            <Church size={18} /> Dados eclesiásticos
          </h3>
          <div className="profile-fields">
            <Field name="Situação" value={label(m.status)} />
            <Field name="Função principal" value={m.functionName} />
            <Field
              name="Funções adicionais"
              value={m.additionalFunctions.map((f) => f.name).join(", ")}
            />
            <Field name="Matriz" value={m.matrixName} />
            <Field
              name="Filial"
              value={m.branchName ?? "Membro direto da Matriz"}
            />
            <Field
              name="Entrada nesta igreja"
              value={date(m.churchEntryDate)}
            />
            <Field name="Igreja de origem" value={m.originChurch} />
            <Field name="Conversão" value={date(m.conversionDate)} />
            <Field name="Batismo" value={date(m.baptismDate)} />
            <Field name="Consagração" value={date(m.consecrationDate)} />
          </div>
        </section>
        {m.notes ? (
          <section className="content-card profile-section profile-section-wide">
            <h3>Observações internas</h3>
            <p className="profile-notes">{m.notes}</p>
          </section>
        ) : null}
        {!printMode && detail.history.length ? (
          <section className="content-card profile-section profile-section-wide member-history">
            <h3>
              <History size={18} /> Histórico eclesiástico
            </h3>
            {detail.history.map((h) => (
              <article key={h.id}>
                <span className="history-dot" />
                <div>
                  <strong>{label(h.eventType)}</strong>
                  <p>{h.description}</p>
                  <small>
                    {h.actorName} ·{" "}
                    {new Date(h.createdAt).toLocaleString("pt-BR")}
                  </small>
                </div>
              </article>
            ))}
          </section>
        ) : null}
        {!printMode && hasPermission("FINANCEIRO_CONTRIBUICOES_VISUALIZAR") ? (
          <section className="content-card profile-section profile-section-wide member-finance-summary">
            <h3><HandCoins size={18}/> Contribuições e privacidade financeira</h3>
            <div className="member-finance-preference">
              <ShieldCheck size={20}/><div><strong>Preferência padrão da Pessoa</strong><p>Cada contribuição ainda pode escolher sua própria privacidade.</p></div>
              <select value={financial?.preference.default_privacy??"IDENTIFICADA_PRIVADA"} disabled={!financial||!hasPermission("FINANCEIRO_CONTRIBUICOES_GERENCIAR")} onChange={async event=>{const defaultPrivacy=event.target.value;const body=await readApi<{result:{defaultPrivacy:string}}>(await fetch(`/api/finance/people/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({defaultPrivacy})}));setFinancial(current=>current?{...current,preference:{default_privacy:body.result.defaultPrivacy}}:current);}}>
                <option value="IDENTIFICADA_PRIVADA">Identificada — privada</option><option value="IDENTIFICADA">Identificada</option>
              </select>
            </div>
            <div className="member-finance-list">{financial?.contributions.length?financial.contributions.map(item=><article key={item.id}><span><strong>{label(item.contribution_type)}</strong><small>{date(item.occurred_on)} · {label(item.privacy)}</small></span><b>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(item.amount_cents/100)}</b></article>):<p>Nenhuma contribuição identificada para esta Pessoa.</p>}</div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  FilePlus2,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Plus,
  Printer,
  Search,
  Upload,
  Download,
  UserRound,
  X,
} from "lucide-react";
import {
  AdminPageHeader,
  EmptyRows,
  LoadingRows,
  Pagination,
  readApi,
  StatusBadge,
  Toast,
} from "@/components/admin/admin-ui";
import { useWorkspace } from "@/components/protected-shell";
import {
  frontendImageError,
  IMAGE_MAX_BYTES,
  SUPPORTED_IMAGE_TYPES,
} from "@/lib/image-policy";
import type {
  MemberDetail,
  MemberOptions,
  MemberPage,
  MemberRecord,
  MemberStatus,
} from "@/lib/members/types";

type FormState = {
  fullName: string;
  status: MemberStatus;
  birthDate: string;
  sex: string;
  cpf: string;
  rg: string;
  voterTitle: string;
  birthCity: string;
  birthState: string;
  phone: string;
  whatsapp: string;
  email: string;
  motherName: string;
  fatherName: string;
  maritalStatus: string;
  spouseName: string;
  spousePersonId: string;
  childrenCount: number;
  postalCode: string;
  street: string;
  addressNumber: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  profession: string;
  workplace: string;
  educationLevel: string;
  theologicalEducation: string;
  primaryFunctionId: string;
  additionalFunctionIds: number[];
  matrixId: string;
  branchId: string;
  churchEntryDate: string;
  originChurch: string;
  conversionDate: string;
  baptismDate: string;
  consecrationDate: string;
  notes: string;
  customValues: Record<string, string>;
};
const empty: FormState = {
  fullName: "",
  status: "MEMBRO_ATIVO",
  birthDate: "",
  sex: "NAO_INFORMADO",
  cpf: "",
  rg: "",
  voterTitle: "",
  birthCity: "",
  birthState: "",
  phone: "",
  whatsapp: "",
  email: "",
  motherName: "",
  fatherName: "",
  maritalStatus: "NAO_INFORMADO",
  spouseName: "",
  spousePersonId: "",
  childrenCount: 0,
  postalCode: "",
  street: "",
  addressNumber: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  profession: "",
  workplace: "",
  educationLevel: "NAO_INFORMADO",
  theologicalEducation: "NAO_INFORMADO",
  primaryFunctionId: "",
  additionalFunctionIds: [],
  matrixId: "",
  branchId: "",
  churchEntryDate: "",
  originChurch: "",
  conversionDate: "",
  baptismDate: "",
  consecrationDate: "",
  notes: "",
  customValues: {},
};
const statuses: MemberStatus[] = [
  "MEMBRO_ATIVO",
  "CONGREGADO",
  "NOVO_CONVERTIDO",
  "VISITANTE",
  "AFASTADO",
  "TRANSFERIDO",
  "DESLIGADO",
  "FALECIDO",
  "INATIVO",
];
const label = (v: string) =>
  v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const displayDate = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${v}T12:00:00Z`),
      )
    : "—";
const selectedCustomValues=(value:string|undefined):string[]=>{if(!value)return[];try{return JSON.parse(value) as string[];}catch{return[];}};
function formFrom(m: MemberRecord): FormState {
  return {
    fullName: m.fullName,
    status: m.status,
    birthDate: m.birthDate ?? "",
    sex: m.sex ?? "NAO_INFORMADO",
    cpf: m.cpf ?? "",
    rg: m.rg ?? "",
    voterTitle: m.voterTitle ?? "",
    birthCity: m.birthCity ?? "",
    birthState: m.birthState ?? "",
    phone: m.phone ?? "",
    whatsapp: m.whatsapp ?? "",
    email: m.email ?? "",
    motherName: m.motherName ?? "",
    fatherName: m.fatherName ?? "",
    maritalStatus: m.maritalStatus ?? "NAO_INFORMADO",
    spouseName: m.spouseName ?? "",
    spousePersonId: m.spousePersonId ? String(m.spousePersonId) : "",
    childrenCount: m.childrenCount,
    postalCode: m.postalCode ?? "",
    street: m.street ?? "",
    addressNumber: m.addressNumber ?? "",
    complement: m.complement ?? "",
    district: m.district ?? "",
    city: m.city ?? "",
    state: m.state ?? "",
    profession: m.profession ?? "",
    workplace: m.workplace ?? "",
    educationLevel: m.educationLevel ?? "NAO_INFORMADO",
    theologicalEducation: m.theologicalEducation ?? "NAO_INFORMADO",
    primaryFunctionId: m.primaryFunctionId ? String(m.primaryFunctionId) : "",
    additionalFunctionIds: m.additionalFunctions.map((x) => x.id),
    matrixId: String(m.matrixId),
    branchId: m.branchId ? String(m.branchId) : "",
    churchEntryDate: m.churchEntryDate ?? "",
    originChurch: m.originChurch ?? "",
    conversionDate: m.conversionDate ?? "",
    baptismDate: m.baptismDate ?? "",
    consecrationDate: m.consecrationDate ?? "",
    notes: m.notes ?? "",
    customValues: Object.fromEntries(m.customValues.map((value) => [String(value.fieldId), value.value])),
  };
}
async function optimizeImage(file: File): Promise<File> {
  if (
    !SUPPORTED_IMAGE_TYPES.includes(
      file.type as (typeof SUPPORTED_IMAGE_TYPES)[number],
    )
  )
    throw new Error("Use uma imagem PNG, JPG, JPEG ou WebP.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas
      .getContext("2d")
      ?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.84),
    );
    if (!blob) throw new Error("Não foi possível preparar a foto.");
    const result = new File([blob], "foto-membro.jpg", { type: "image/jpeg" });
    if (result.size > IMAGE_MAX_BYTES)
      throw new Error(
        "A foto continuou muito grande após a otimização. Escolha outra imagem.",
      );
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function MemberForm({
  member,
  options,
  onClose,
  onSaved,
}: {
  member: MemberRecord | null;
  options: MemberOptions;
  onClose: () => void;
  onSaved: (message: string, id: number) => void;
}) {
  const { hasPermission } = useWorkspace();
  const [form, setForm] = useState<FormState>(
    member
      ? formFrom(member)
      : {
          ...empty,
          matrixId: options.unitContext.matrixId
            ? String(options.unitContext.matrixId)
            : options.matrices.length === 1 ? String(options.matrices[0].id) : "",
          branchId: options.unitContext.branchId
            ? String(options.unitContext.branchId)
            : options.branches.length === 1 ? String(options.branches[0].id) : "",
        },
  );
  const [busy, setBusy] = useState(false);
  const [cepBusy, setCepBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(member?.photoUrl ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const branches = options.branches.filter(
    (b) => String(b.matrixId) === form.matrixId,
  );
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  async function chooseFile(selected: File | null) {
    if (!selected) return;
    setError("");
    try {
      const optimized = await optimizeImage(selected);
      const invalid = frontendImageError(optimized);
      if (invalid) throw new Error(invalid);
      setFile(optimized);
      setPreview(URL.createObjectURL(optimized));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foto inválida.");
    }
  }
  async function cep() {
    setCepBusy(true);
    setError("");
    try {
      const body = await readApi<{
        address: {
          postalCode: string;
          street: string;
          district: string;
          city: string;
          state: string;
          complement: string;
        };
      }>(
        await fetch(
          `/api/admin/postal-code?postalCode=${encodeURIComponent(form.postalCode)}`,
          { cache: "no-store" },
        ),
      );
      setForm((p) => ({
        ...p,
        ...body.address,
        addressNumber: p.addressNumber,
        complement: p.complement || body.address.complement,
      }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível buscar o CEP.",
      );
    } finally {
      setCepBusy(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        matrixId: Number(form.matrixId),
        branchId: form.branchId ? Number(form.branchId) : null,
        primaryFunctionId: form.primaryFunctionId
          ? Number(form.primaryFunctionId)
          : null,
        spousePersonId: form.spousePersonId
          ? Number(form.spousePersonId)
          : null,
        birthDate: form.birthDate || null,
        churchEntryDate: form.churchEntryDate || null,
        conversionDate: form.conversionDate || null,
        baptismDate: form.baptismDate || null,
        consecrationDate: form.consecrationDate || null,
      };
      const response = await fetch(
        member ? `/api/admin/members/${member.id}` : "/api/admin/members",
        {
          method: member ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await readApi<{ member: MemberRecord; message: string }>(
        response,
      );
      if (file) {
        await readApi(
          await fetch(`/api/admin/members/${body.member.id}/photo`, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          }),
        );
      }
      onSaved(body.message, body.member.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar o membro.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function removePhoto() {
    if (!member) return;
    setBusy(true);
    try {
      const b = await readApi<{ message: string }>(
        await fetch(`/api/admin/members/${member.id}/photo`, {
          method: "DELETE",
        }),
      );
      setPreview("");
      setFile(null);
      setError("");
      onSaved(b.message, member.id);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível remover a foto.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dialog-backdrop">
      <section
        className="dialog-card member-dialog"
        role="dialog"
        aria-modal="true"
      >
        <header className="dialog-heading">
          <span className="dialog-icon">
            <UserRound size={22} />
          </span>
          <div>
            <p className="eyebrow">Secretaria eclesiástica</p>
            <h2>{member ? `Editar ${member.fullName}` : "Novo membro"}</h2>
            {member ? <span>Código {member.memberCode}</span> : null}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <form className="member-form" onSubmit={submit}>
          <section className="member-photo-editor">
            <div className="member-photo-preview">
              {preview ? (
                <img src={preview} alt="Prévia da foto" />
              ) : (
                <UserRound size={44} />
              )}
            </div>
            <div>
              <strong>Foto do membro</strong>
              <p>A imagem será redimensionada e otimizada antes do envio.</p>
              <div className="member-photo-actions">
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} />
                  Escolher foto
                </button>
                {preview && member ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void removePhoto()}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                onChange={(e) => void chooseFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </section>
          <fieldset>
            <legend>1. Identificação</legend>
            <div className="form-grid">
              <label className="field-group form-span-2">
                <span>Nome completo *</span>
                <input
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  required
                  maxLength={180}
                />
              </label>
              <label className="field-group">
                <span>Situação *</span>
                <select
                  value={form.status}
                  onChange={(e) =>
                    set("status", e.target.value as MemberStatus)
                  }
                  disabled={
                    Boolean(member) &&
                    !hasPermission("MEMBROS_ALTERAR_SITUACAO")
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Sexo</span>
                <select
                  value={form.sex}
                  onChange={(e) => set("sex", e.target.value)}
                >
                  <option value="NAO_INFORMADO">Não informado</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMININO">Feminino</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>2. Dados pessoais</legend>
            <div className="form-grid">
              <label className="field-group">
                <span>Data de nascimento</span>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>CPF</span>
                <input
                  value={form.cpf}
                  onChange={(e) => set("cpf", e.target.value)}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </label>
              <label className="field-group">
                <span>RG</span>
                <input
                  value={form.rg}
                  onChange={(e) => set("rg", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Título de Eleitor</span>
                <input value={form.voterTitle} onChange={(e) => set("voterTitle", e.target.value)} inputMode="numeric" />
              </label>
              <label className="field-group">
                <span>Naturalidade</span>
                <input
                  value={form.birthCity}
                  onChange={(e) => set("birthCity", e.target.value)}
                  placeholder="Cidade"
                />
              </label>
              <label className="field-group">
                <span>UF de nascimento</span>
                <input
                  value={form.birthState}
                  onChange={(e) =>
                    set("birthState", e.target.value.toUpperCase())
                  }
                  maxLength={2}
                />
              </label>
              <label className="field-group">
                <span>Telefone</span>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  inputMode="tel"
                />
              </label>
              <label className="field-group">
                <span>WhatsApp</span>
                <input
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  inputMode="tel"
                />
              </label>
              <label className="field-group">
                <span>E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </label>
            </div>
          </fieldset>
          {options.customFields.length ? <fieldset>
            <legend>Informações adicionais</legend>
            <div className="form-grid">
              {options.customFields.map((field) => <label className={`field-group ${field.fieldType === "TEXTO_LONGO" ? "form-span-2" : ""}`} key={field.id}>
                <span>{field.name}{field.required ? " *" : ""}</span>
                {field.fieldType === "TEXTO_LONGO" ? <textarea value={form.customValues[String(field.id)] ?? ""} onChange={(e) => set("customValues",{...form.customValues,[String(field.id)]:e.target.value})} required={field.required} /> : field.fieldType === "LISTA_OPCOES" ? <select multiple value={selectedCustomValues(form.customValues[String(field.id)])} onChange={(e) => set("customValues",{...form.customValues,[String(field.id)]:JSON.stringify([...e.target.selectedOptions].map(option=>option.value))})} required={field.required}>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select> : field.fieldType === "SIM_NAO" || field.fieldType === "SELECAO_UNICA" ? <select value={form.customValues[String(field.id)] ?? ""} onChange={(e) => set("customValues",{...form.customValues,[String(field.id)]:e.target.value})} required={field.required}><option value="">Selecione</option>{(field.fieldType === "SIM_NAO" ? [{value:"SIM",label:"Sim"},{value:"NAO",label:"Não"}] : field.options.map(option=>({value:option,label:option}))).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.fieldType === "DATA" ? "date" : field.fieldType === "NUMERO" ? "number" : field.fieldType === "EMAIL" ? "email" : "text"} inputMode={field.fieldType === "TELEFONE" ? "tel" : undefined} value={form.customValues[String(field.id)] ?? ""} onChange={(e) => set("customValues",{...form.customValues,[String(field.id)]:e.target.value})} required={field.required} />}
                {field.helpText ? <small>{field.helpText}</small> : null}
              </label>)}
            </div>
          </fieldset> : null}
          <fieldset>
            <legend>3. Endereço</legend>
            <div className="form-grid">
              <div className="field-group">
                <span>CEP</span>
                <div className="inline-field">
                  <input
                    value={form.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void cep()}
                    disabled={cepBusy}
                  >
                    {cepBusy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <MapPin size={16} />
                    )}
                    Buscar
                  </button>
                </div>
              </div>
              <label className="field-group form-span-2">
                <span>Logradouro</span>
                <input
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Número</span>
                <input
                  value={form.addressNumber}
                  onChange={(e) => set("addressNumber", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Complemento</span>
                <input
                  value={form.complement}
                  onChange={(e) => set("complement", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Bairro</span>
                <input
                  value={form.district}
                  onChange={(e) => set("district", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Cidade</span>
                <input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>UF</span>
                <input
                  value={form.state}
                  onChange={(e) => set("state", e.target.value.toUpperCase())}
                  maxLength={2}
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>4. Família</legend>
            <div className="form-grid">
              <label className="field-group">
                <span>Nome da mãe</span>
                <input
                  value={form.motherName}
                  onChange={(e) => set("motherName", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Nome do pai</span>
                <input
                  value={form.fatherName}
                  onChange={(e) => set("fatherName", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Estado civil</span>
                <select
                  value={form.maritalStatus}
                  onChange={(e) => set("maritalStatus", e.target.value)}
                >
                  {[
                    "NAO_INFORMADO",
                    "SOLTEIRO",
                    "CASADO",
                    "DIVORCIADO",
                    "VIUVO",
                    "UNIAO_ESTAVEL",
                    "OUTRO",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Nome do cônjuge</span>
                <input
                  value={form.spouseName}
                  onChange={(e) => set("spouseName", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Vincular pessoa cadastrada</span>
                <select
                  value={form.spousePersonId}
                  onChange={(e) => set("spousePersonId", e.target.value)}
                >
                  <option value="">Sem vínculo</option>
                  {options.spouses
                    .filter((s) => s.id !== member?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.memberCode} · {s.fullName}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field-group">
                <span>Quantidade de filhos</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={form.childrenCount}
                  onChange={(e) => set("childrenCount", Number(e.target.value))}
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>5. Formação e profissão</legend>
            <div className="form-grid">
              <label className="field-group">
                <span>Profissão</span>
                <input
                  value={form.profession}
                  onChange={(e) => set("profession", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Local de trabalho</span>
                <input
                  value={form.workplace}
                  onChange={(e) => set("workplace", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Escolaridade</span>
                <select
                  value={form.educationLevel}
                  onChange={(e) => set("educationLevel", e.target.value)}
                >
                  {[
                    "NAO_INFORMADO",
                    "NAO_ALFABETIZADO",
                    "FUNDAMENTAL_INCOMPLETO",
                    "FUNDAMENTAL_COMPLETO",
                    "MEDIO_INCOMPLETO",
                    "MEDIO_COMPLETO",
                    "SUPERIOR_INCOMPLETO",
                    "SUPERIOR_COMPLETO",
                    "POS_GRADUACAO",
                    "MESTRADO",
                    "DOUTORADO",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Formação teológica</span>
                <select
                  value={form.theologicalEducation}
                  onChange={(e) => set("theologicalEducation", e.target.value)}
                >
                  {[
                    "NAO_INFORMADO",
                    "NENHUMA",
                    "BASICO",
                    "MEDIO",
                    "AVANCADO",
                    "OUTRO",
                  ].map((x) => (
                    <option key={x} value={x}>
                      {label(x)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>6. Dados eclesiásticos</legend>
            <div className="form-grid">
              <label className="field-group">
                <span>Matriz * {options.unitContext.matrixLocked ? <LockKeyhole className="member-field-lock" aria-label="Campo bloqueado" /> : null}</span>
                <select
                  value={form.matrixId}
                  onChange={(e) => {
                    set("matrixId", e.target.value);
                    set("branchId", "");
                  }}
                  required
                  disabled={
                    options.unitContext.matrixLocked ||
                    (Boolean(member) && !hasPermission("MEMBROS_TRANSFERIR"))
                  }
                >
                  <option value="">Selecione</option>
                  {options.matrices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Filial {options.unitContext.branchLocked ? <LockKeyhole className="member-field-lock" aria-label="Campo bloqueado" /> : null}</span>
                <select
                  value={form.branchId}
                  onChange={(e) => set("branchId", e.target.value)}
                  disabled={
                    options.unitContext.branchLocked ||
                    (Boolean(member) && !hasPermission("MEMBROS_TRANSFERIR"))
                  }
                  required={options.unitContext.scope === "FILIAL"}
                >
                  {options.unitContext.scope !== "FILIAL" ? <option value="">Membro direto da Matriz</option> : null}
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {options.unitContext.scope === "FILIAL" ? <small>Vínculo definido automaticamente pelo seu acesso.</small> : null}
              </label>
              <label className="field-group">
                <span>Função ministerial</span>
                <select
                  value={form.primaryFunctionId}
                  onChange={(e) => set("primaryFunctionId", e.target.value)}
                >
                  <option value="">Sem função</option>
                  {options.functions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Funções adicionais</span>
                <select
                  multiple
                  className="member-multi-select"
                  value={form.additionalFunctionIds.map(String)}
                  onChange={(event) =>
                    set(
                      "additionalFunctionIds",
                      Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)),
                    )
                  }
                >
                  {options.functions
                    .filter((item) => String(item.id) !== form.primaryFunctionId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                <small>Use Ctrl/Cmd para selecionar mais de uma.</small>
              </label>
              <label className="field-group">
                <span>Data de entrada nesta igreja</span>
                <input
                  type="date"
                  value={form.churchEntryDate}
                  onChange={(e) => set("churchEntryDate", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Igreja de origem</span>
                <input
                  value={form.originChurch}
                  onChange={(e) => set("originChurch", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Data de conversão</span>
                <input
                  type="date"
                  value={form.conversionDate}
                  onChange={(e) => set("conversionDate", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Data de batismo</span>
                <input
                  type="date"
                  value={form.baptismDate}
                  onChange={(e) => set("baptismDate", e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Data de consagração</span>
                <input
                  type="date"
                  value={form.consecrationDate}
                  onChange={(e) => set("consecrationDate", e.target.value)}
                />
              </label>
            </div>
          </fieldset>
          {hasPermission("MEMBROS_OBSERVACOES_VISUALIZAR") ||
          hasPermission("MEMBROS_OBSERVACOES_EDITAR") ? (
            <fieldset>
              <legend>7. Observações internas</legend>
              <label className="field-group">
                <span>Observações</span>
                <textarea
                  rows={5}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  disabled={!hasPermission("MEMBROS_OBSERVACOES_EDITAR")}
                />
              </label>
            </fieldset>
          ) : null}
          <div
            className={`form-feedback${error ? " form-feedback-visible" : ""}`}
          >
            {error}
          </div>
          <footer className="dialog-actions sticky-dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button className="primary-button compact-button" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <FilePlus2 size={18} />
              )}
              Salvar membro
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function MembersManager() {
  const { hasPermission } = useWorkspace();
  const [result, setResult] = useState<MemberPage | null>(null);
  const [options, setOptions] = useState<MemberOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [matrix, setMatrix] = useState("");
  const [branch, setBranch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState({
    message: "",
    kind: "success" as "success" | "error",
  });
  const query = useMemo(
    () =>
      new URLSearchParams({
        search,
        status,
        matrixId: matrix,
        branchId: branch,
        page: String(page),
        pageSize: "12",
      }).toString(),
    [search, status, matrix, branch, page],
  );
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const [a, b] = await Promise.all([
          fetch(`/api/admin/members?${query}`, { cache: "no-store" }),
          fetch("/api/admin/members/options", { cache: "no-store" }),
        ]);
        const [members, opts] = await Promise.all([
          readApi<{ result: MemberPage }>(a),
          readApi<{ options: MemberOptions }>(b),
        ]);
        if (active) {
          setResult(members.result);
          setOptions(opts.options);
        }
      } catch (e) {
        if (active)
          setToast({
            message:
              e instanceof Error
                ? e.message
                : "Não foi possível carregar membros.",
            kind: "error",
          });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [query, refresh]);
  function saved(message: string) {
    setOpen(false);
    setEditing(null);
    setToast({ message, kind: "success" });
    setRefresh((v) => v + 1);
  }
  async function openEdit(member: MemberRecord) {
    try {
      const body = await readApi<{ detail: MemberDetail }>(
        await fetch(`/api/admin/members/${member.id}`, { cache: "no-store" }),
      );
      setEditing(body.detail.member);
      setOpen(true);
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o cadastro.",
        kind: "error",
      });
    }
  }
  const exportHref=useMemo(()=>{const params=new URLSearchParams();if(search.trim())params.set("search",search.trim());if(status)params.set("status",status);if(matrix)params.set("matrixId",matrix);if(branch)params.set("branchId",branch);const query=params.toString();return `/painel/dados-exportacao${query?`?${query}`:""}`;},[search,status,matrix,branch]);
  return (
    <>
      <AdminPageHeader
        eyebrow="Secretaria eclesiástica"
        title="Pessoas / Membros"
        description="Cadastre e acompanhe membros, congregados, visitantes e seu histórico, sempre dentro do seu escopo organizacional."
        action={
          <div className="header-action-group">
            {hasPermission("PRECADASTROS_VISUALIZAR") ? <Link className="secondary-button compact-button" href="/painel/membros/pre-cadastros">Pré-cadastros</Link> : null}
            {hasPermission("FORMULARIOS_PRECADASTRO_GERENCIAR") ? <Link className="secondary-button compact-button" href="/painel/membros/formularios">Links públicos</Link> : null}
            {hasPermission("CAMPOS_MEMBROS_CONFIGURAR") ? <Link className="secondary-button compact-button" href="/painel/membros/configuracao">Campos</Link> : null}
            {hasPermission("DADOS_EXPORTAR") ? <Link className="secondary-button compact-button" href={exportHref}><Download size={17}/>Exportar resultados</Link> : null}
            <Link className="text-button contextual-help-link" href="/painel/ajuda?artigo=cadastrar-membro">Como funciona?</Link>
          {hasPermission("MEMBROS_CRIAR") ? (
            <button
              className="primary-button compact-button"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus size={18} />
              Novo membro
            </button>
          ) : null}
          </div>
        }
      />
      <section className="content-card member-filters">
        <div className="search-box">
          <Search size={19} />
          <input
            placeholder="Código, nome, CPF, RG, título, telefone ou e-mail"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as situações</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select
          value={matrix}
          onChange={(e) => {
            setMatrix(e.target.value);
            setBranch("");
            setPage(1);
          }}
        >
          <option value="">Todas as Matrizes</option>
          {options?.matrices.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as Filiais</option>
          {options?.branches
            .filter((b) => !matrix || String(b.matrixId) === matrix)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </select>
      </section>
      <section className="content-card admin-list-card">
        <div className="table-wrap">
          <table className="admin-table members-table">
            <thead>
              <tr>
                <th>Membro</th>
                <th>Código</th>
                <th>Situação</th>
                <th>Função</th>
                <th>Unidade</th>
                <th>Contato</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRows columns={7} />
              ) : !result?.items.length ? (
                <EmptyRows columns={7} message="Nenhum membro encontrado." />
              ) : (
                result.items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="member-list-person">
                        <span className="member-mini-avatar">
                          {m.photoUrl ? (
                            <img src={m.photoUrl} alt="" />
                          ) : (
                            <UserRound size={20} />
                          )}
                        </span>
                        <div>
                          <strong>{m.fullName}</strong>
                          <small>
                            {m.birthDate
                              ? `${displayDate(m.birthDate)}${m.age !== null ? ` · ${m.age} anos` : ""}`
                              : "Nascimento não informado"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{m.memberCode}</strong>
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>{m.functionName ?? "—"}</td>
                    <td>
                      {m.branchName ?? m.matrixName}
                      <small>{m.branchName ? m.matrixName : "Matriz"}</small>
                    </td>
                    <td>
                      {m.whatsapp ?? m.phone ?? "—"}
                      <small>{m.email ?? ""}</small>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link
                          className="icon-button"
                          href={`/painel/membros/${m.id}`}
                          title="Ver ficha"
                        >
                          <Eye size={17} />
                        </Link>
                        {hasPermission("MEMBROS_EDITAR") ? (
                          <button
                            className="icon-button"
                            onClick={() => void openEdit(m)}
                            title="Editar"
                          >
                            <FilePlus2 size={17} />
                          </button>
                        ) : null}
                        {hasPermission("MEMBROS_IMPRIMIR") ? (
                          <Link
                            className="icon-button"
                            href={`/painel/membros/${m.id}/imprimir`}
                            target="_blank"
                            title="Imprimir"
                          >
                            <Printer size={17} />
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {result ? (
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            onPage={setPage}
          />
        ) : null}
      </section>
      {open && options ? (
        <MemberForm
          member={editing}
          options={options}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onSaved={saved}
        />
      ) : null}
      <Toast {...toast} onClose={() => setToast({ ...toast, message: "" })} />
    </>
  );
}

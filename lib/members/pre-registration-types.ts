import type { MemberCustomField, MemberWriteInput } from "@/lib/members/types";

export type PreRegistrationStatus="PENDENTE"|"EM_ANALISE"|"AGUARDANDO_CORRECAO"|"APROVADO"|"RECUSADO";

export interface PreRegistrationFormRecord {
  id:number;tenantId:number;name:string;status:"ATIVO"|"INATIVO";unitId:number|null;unitName:string|null;unitType:"CONVENCAO"|"MATRIZ"|"FILIAL"|null;
  expiresAt:string|null;submissionCount:number;pendingCount:number;tokenPrefix:string;createdAt:string;updatedAt:string;publicUrl?:string|null;
}

export interface PublicPreRegistrationForm {
  name:string;institutionName:string;unitName:string|null;expiresAt:string|null;customFields:MemberCustomField[];
}

export interface PreRegistrationListItem {
  id:number;fullName:string;maskedCpf:string|null;phone:string|null;whatsapp:string|null;status:PreRegistrationStatus;unitName:string|null;
  photoUrl:string|null;createdAt:string;
}

export interface PreRegistrationDetail extends PreRegistrationListItem {
  birthDate:string|null;cpf:string|null;email:string|null;voterTitle:string|null;matrixId:number|null;branchId:number|null;
  payload:MemberWriteInput;customValues:Record<string,string>;consentAt:string;consentVersion:string;reviewReason:string|null;
  duplicate:{id:number;memberCode:string;fullName:string;maskedCpf:string|null}|null;approvedMemberId:number|null;
}

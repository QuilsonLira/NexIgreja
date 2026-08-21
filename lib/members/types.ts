import type { PageResult } from "@/lib/admin/types";

export type MemberStatus="MEMBRO_ATIVO"|"CONGREGADO"|"NOVO_CONVERTIDO"|"VISITANTE"|"AFASTADO"|"TRANSFERIDO"|"DESLIGADO"|"FALECIDO"|"INATIVO";
export type MemberSex="MASCULINO"|"FEMININO"|"NAO_INFORMADO";
export type MaritalStatus="SOLTEIRO"|"CASADO"|"DIVORCIADO"|"VIUVO"|"UNIAO_ESTAVEL"|"OUTRO"|"NAO_INFORMADO";
export type EducationLevel="NAO_INFORMADO"|"NAO_ALFABETIZADO"|"FUNDAMENTAL_INCOMPLETO"|"FUNDAMENTAL_COMPLETO"|"MEDIO_INCOMPLETO"|"MEDIO_COMPLETO"|"SUPERIOR_INCOMPLETO"|"SUPERIOR_COMPLETO"|"POS_GRADUACAO"|"MESTRADO"|"DOUTORADO";
export type TheologicalEducation="NAO_INFORMADO"|"NENHUMA"|"BASICO"|"MEDIO"|"AVANCADO"|"OUTRO";
export type CustomFieldType="TEXTO_CURTO"|"TEXTO_LONGO"|"NUMERO"|"DATA"|"SIM_NAO"|"LISTA_OPCOES"|"SELECAO_UNICA"|"TELEFONE"|"EMAIL";

export interface MemberCustomField {
  id:number;tenantId:number;name:string;fieldType:CustomFieldType;helpText:string|null;required:boolean;status:"ATIVO"|"INATIVO";
  displayOrder:number;sectionName:string;showAdmin:boolean;showPublic:boolean;showPrint:boolean;options:string[];hasValues?:boolean;createdAt:string;updatedAt:string;
}
export interface MemberCustomValue {fieldId:number;name:string;fieldType:CustomFieldType;sectionName:string;value:string;showPrint:boolean;}

export interface MemberWriteInput {
  fullName:unknown; status?:unknown; birthDate?:unknown; sex?:unknown; cpf?:unknown; rg?:unknown; birthCity?:unknown; birthState?:unknown;
  phone?:unknown; whatsapp?:unknown; email?:unknown; voterTitle?:unknown; motherName?:unknown; fatherName?:unknown; maritalStatus?:unknown; spouseName?:unknown;
  spousePersonId?:unknown; childrenCount?:unknown; postalCode?:unknown; street?:unknown; addressNumber?:unknown; complement?:unknown; district?:unknown;
  city?:unknown; state?:unknown; profession?:unknown; workplace?:unknown; educationLevel?:unknown; theologicalEducation?:unknown;
  primaryFunctionId?:unknown; additionalFunctionIds?:unknown; matrixId?:unknown; branchId?:unknown; churchEntryDate?:unknown; originChurch?:unknown;
  conversionDate?:unknown; baptismDate?:unknown; consecrationDate?:unknown; notes?:unknown; memberNumber?:unknown; importMode?:unknown; customValues?:unknown;
}

export interface MemberRecord {
  id:number; tenantId:number; memberNumber:number; memberCode:string; fullName:string; status:MemberStatus; birthDate:string|null; age:number|null;
  sex:MemberSex|null; cpf:string|null; maskedCpf:string|null; rg:string|null; voterTitle:string|null; birthCity:string|null; birthState:string|null; phone:string|null; whatsapp:string|null;
  email:string|null; motherName:string|null; fatherName:string|null; maritalStatus:MaritalStatus|null; spouseName:string|null; spousePersonId:number|null;
  spouseLinkedName:string|null; childrenCount:number; postalCode:string|null; street:string|null; addressNumber:string|null; complement:string|null;
  district:string|null; city:string|null; state:string|null; profession:string|null; workplace:string|null; educationLevel:EducationLevel|null;
  theologicalEducation:TheologicalEducation|null; primaryFunctionId:number|null; functionName:string|null; additionalFunctions:Array<{id:number;name:string}>;
  matrixId:number; matrixName:string; branchId:number|null; branchName:string|null; conventionName:string; churchEntryDate:string|null; originChurch:string|null;
  conversionDate:string|null; baptismDate:string|null; consecrationDate:string|null; notes:string|null; customValues:MemberCustomValue[]; photoUrl:string|null; unitLogoUrl:string|null; createdAt:string; updatedAt:string;
}

export interface MemberHistoryRecord {id:number;eventType:string;description:string;eventDate:string|null;actorName:string;createdAt:string;}
export interface MemberDetail {member:MemberRecord;history:MemberHistoryRecord[];}
export interface MemberOptions {
  matrices:Array<{id:number;name:string}>;
  branches:Array<{id:number;name:string;matrixId:number}>;
  functions:Array<{id:number;name:string}>;
  spouses:Array<{id:number;memberCode:string;fullName:string}>;
  customFields:MemberCustomField[];
  unitContext:{scope:"CONVENCAO"|"MATRIZ"|"FILIAL";matrixId:number|null;branchId:number|null;matrixLocked:boolean;branchLocked:boolean};
}
export type MemberPage=PageResult<MemberRecord>;

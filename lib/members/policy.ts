import type { AdministrativeActor } from "@/lib/types";

export function formatMemberCode(number:number):string{return String(number).padStart(6,"0");}
export function calculateAge(birthDate:string|null,today:string):number|null {if(!birthDate)return null;const [y,m,d]=birthDate.split("-").map(Number);const [ty,tm,td]=today.split("-").map(Number);return ty-y-(tm<m||(tm===m&&td<d)?1:0);}
export function maskCpf(cpf:string|null):string|null{return cpf?`***.${cpf.slice(3,6)}.${cpf.slice(6,9)}-**`:null;}
export function canAccessMemberScope(actor:Pick<AdministrativeActor,"tenantId"|"scope"|"boundMatrixId"|"boundBranchId">,target:{tenantId:number;matrixId:number;branchId:number|null}):boolean{
  if(actor.tenantId!==target.tenantId)return false;
  if(actor.scope==="CONVENCAO")return true;
  if(actor.scope==="MATRIZ")return actor.boundMatrixId===target.matrixId;
  return actor.boundBranchId!==null&&actor.boundBranchId===target.branchId;
}
export function memberHistoryEvents(before:{status:string;matrixId:number;branchId:number|null;primaryFunctionId:number|null;baptismDate:string|null;consecrationDate:string|null},after:typeof before):Array<{type:string;description:string}>{const events:Array<{type:string;description:string}>=[];
  if(before.status!==after.status)events.push({type:"SITUACAO_ALTERADA",description:`Situação alterada de ${before.status.replaceAll("_"," ")} para ${after.status.replaceAll("_"," ")}.`});
  if(before.matrixId!==after.matrixId||before.branchId!==after.branchId)events.push({type:"TRANSFERENCIA_INTERNA",description:"Vínculo organizacional do membro foi alterado."});
  if(before.primaryFunctionId!==after.primaryFunctionId)events.push({type:"FUNCAO_ALTERADA",description:"Função ministerial principal foi alterada."});
  if(!before.baptismDate&&after.baptismDate)events.push({type:"BATISMO_REGISTRADO",description:`Batismo registrado em ${after.baptismDate}.`});
  if(!before.consecrationDate&&after.consecrationDate)events.push({type:"CONSAGRACAO_REGISTRADA",description:`Consagração registrada em ${after.consecrationDate}.`});
  return events;}

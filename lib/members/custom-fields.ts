import type { CustomFieldType, MemberCustomField } from "@/lib/members/types";

export const CUSTOM_FIELD_TYPES:CustomFieldType[]=["TEXTO_CURTO","TEXTO_LONGO","NUMERO","DATA","SIM_NAO","LISTA_OPCOES","SELECAO_UNICA","TELEFONE","EMAIL"];
export const CONSENT_VERSION="2026-08-11-v1";
export const CONSENT_TEXT="Confirmo que as informações fornecidas são verdadeiras e autorizo o envio desses dados à instituição identificada neste formulário para fins de cadastro e administração interna.";

export function normalizedFieldName(value:string):string{return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80);}
export function parseFieldOptions(value:unknown):string[]{const source=Array.isArray(value)?value:typeof value==="string"?value.split(/\r?\n|,/):[];return [...new Set(source.map(item=>String(item).trim().replace(/[<>]/g,"").slice(0,80)).filter(Boolean))].slice(0,50);}
export function customValue(field:Pick<MemberCustomField,"fieldType"|"required"|"options"|"name">,value:unknown):string|null{
  if(value===null||value===undefined||value===""){if(field.required)throw new Error(`${field.name} é obrigatório.`);return null;}
  if(field.fieldType==="LISTA_OPCOES"){
    let source=value;
    if(typeof value==="string"&&value.trim().startsWith("[")){try{source=JSON.parse(value);}catch{source=value;}}
    const values=(Array.isArray(source)?source:[source]).map(String).filter(item=>field.options.includes(item));
    if(!values.length){if(field.required)throw new Error(`${field.name} é obrigatório.`);return null;}return JSON.stringify([...new Set(values)]);
  }
  let text=String(value).trim();if(!text){if(field.required)throw new Error(`${field.name} é obrigatório.`);return null;}if(/[<>]/.test(text))throw new Error(`${field.name} não aceita código HTML.`);
  if(field.fieldType==="TEXTO_CURTO"&&text.length>180)throw new Error(`${field.name} deve ter até 180 caracteres.`);
  if(field.fieldType==="TEXTO_LONGO"&&text.length>3000)throw new Error(`${field.name} deve ter até 3000 caracteres.`);
  if(field.fieldType==="NUMERO"&&!/^-?\d+(?:[.,]\d+)?$/.test(text))throw new Error(`${field.name} deve ser um número.`);
  if(field.fieldType==="DATA"&&(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(`${text}T12:00:00Z`))))throw new Error(`${field.name} deve ser uma data válida.`);
  if(field.fieldType==="SIM_NAO"){text=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();if(!['SIM','NAO'].includes(text))throw new Error(`${field.name} deve ser Sim ou Não.`);}
  if(field.fieldType==="SELECAO_UNICA"&&!field.options.includes(text))throw new Error(`${field.name} possui uma opção inválida.`);
  if(field.fieldType==="EMAIL"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))throw new Error(`${field.name} deve ser um e-mail válido.`);
  if(field.fieldType==="TELEFONE"&&text.replace(/\D/g,"").length<10)throw new Error(`${field.name} deve ser um telefone com DDD.`);
  return text.slice(0,field.fieldType==="TEXTO_LONGO"?3000:500);
}

export function displayCustomValue(fieldType:CustomFieldType,value:string):string{
  if(fieldType==="LISTA_OPCOES"){try{return (JSON.parse(value) as string[]).join(", ");}catch{return value;}}
  return value==="SIM"?"Sim":value==="NAO"?"Não":value;
}

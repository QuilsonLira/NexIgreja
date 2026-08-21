import assert from "node:assert/strict";
import test from "node:test";
import { customValue,normalizedFieldName,parseFieldOptions } from "../lib/members/custom-fields.ts";
const field={id:1,tenantId:1,name:"Tamanho da camisa",fieldType:"SELECAO_UNICA" as const,helpText:null,required:true,status:"ATIVO" as const,displayOrder:0,sectionName:"Extra",showAdmin:true,showPublic:true,showPrint:true,options:["P","M","G"],hasValues:false,createdAt:"x",updatedAt:"x"};
test("campo personalizado normaliza nome e opções",()=>{assert.equal(normalizedFieldName("  Número  do Uniforme "),"numero_do_uniforme");assert.deepEqual(parseFieldOptions([" P ","M","P"]),["P","M"]);});
test("seleção aceita somente opção cadastrada e respeita obrigatório",()=>{assert.equal(customValue(field,"M"),"M");assert.throws(()=>customValue(field,"GG"));assert.throws(()=>customValue(field,""));});
test("campos não aceitam HTML e sim/não é normalizado",()=>{assert.throws(()=>customValue({...field,fieldType:"TEXTO_CURTO",options:[]},"<script>"));assert.equal(customValue({...field,fieldType:"SIM_NAO",options:[]},"Não"),"NAO");});
test("lista aceita múltiplos valores enviados pelo formulário",()=>{const list={...field,fieldType:"LISTA_OPCOES" as const,required:false};assert.equal(customValue(list,["P","G"]),'["P","G"]');assert.equal(customValue(list,'["M","G"]'),'["M","G"]');});

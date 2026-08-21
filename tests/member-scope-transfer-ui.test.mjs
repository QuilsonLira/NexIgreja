import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const members=readFileSync(new URL("../components/admin/members-manager.tsx",import.meta.url),"utf8");
const memberServer=readFileSync(new URL("../lib/server/members.ts",import.meta.url),"utf8");
const secretary=readFileSync(new URL("../components/secretary-manager.tsx",import.meta.url),"utf8");
const secretaryServer=readFileSync(new URL("../lib/server/secretary.ts",import.meta.url),"utf8");

test("cadastro da Filial mostra Matriz e Filial automáticas e bloqueadas",()=>{for(const value of ["unitContext.matrixId","unitContext.branchId","unitContext.matrixLocked","unitContext.branchLocked","Vínculo definido automaticamente pelo seu acesso","options.unitContext.scope !== \"FILIAL\""])assert.ok(members.includes(value),value);for(const value of ["JOIN organizational_units m ON m.id=b.parent_id","UNIDADE_BLOQUEADA","return validateUnits(session, branch.matrix_id, branch.id)"])assert.ok(memberServer.includes(value),value);});

test("solicitação de recebimento usa autocomplete específico e destino protegido",()=>{for(const value of ["/api/secretary/transfer-candidates","Digite ao menos 3 caracteres","Trazer/receber membro","Destino automático conforme seu acesso","request_direction===\"RECEBIMENTO\""])assert.ok(secretary.includes(value),value);for(const value of ["term.length<3","LIMIT 20","secretary_transfer_search_limits","DESTINO_BLOQUEADO","status NOT IN ('FALECIDO','TRANSFERIDO','DESLIGADO')","p.tenant_id=?"])assert.ok(secretaryServer.includes(value),value);});

test("busca retorna somente identificação mínima e ficha geral continua no escopo",()=>{const query=secretaryServer.match(/SELECT p\.id,p\.member_number,p\.full_name,p\.status,COALESCE\(b\.id,m\.id\)[\s\S]*?LIMIT 20/)?.[0]||"";for(const sensitive of ["p.cpf","p.rg","p.address","finance_movements"])assert.equal(query.includes(sensitive),false,`não deve retornar ${sensitive}`);assert.ok(memberServer.includes("!row || !actorCan(session, row)"));assert.ok(secretaryServer.includes("candidate=await database().prepare(`${personSelect} WHERE id=? AND tenant_id=?"));});

import assert from "node:assert/strict";
import test from "node:test";
import {canGenerateCompleteExport,exportScopeClause} from "../lib/export/policy.ts";
test("exportação sempre acrescenta o recorte de Matriz ou Filial",()=>{assert.deepEqual(exportScopeClause("MATRIZ",20,null),{sql:" AND p.matrix_id=?",bindings:[20]});assert.deepEqual(exportScopeClause("FILIAL",20,30),{sql:" AND p.branch_id=?",bindings:[30]});assert.deepEqual(exportScopeClause("CONVENCAO",null,null),{sql:"",bindings:[]});});
test("pacote completo é restrito à Convenção ou Platform Owner",()=>{assert.equal(canGenerateCompleteExport("CONVENCAO",false),true);assert.equal(canGenerateCompleteExport("MATRIZ",false),false);assert.equal(canGenerateCompleteExport("FILIAL",false),false);assert.equal(canGenerateCompleteExport("FILIAL",true),true);});

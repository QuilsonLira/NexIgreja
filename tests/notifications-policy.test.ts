import assert from "node:assert/strict";
import test from "node:test";
import {canReceivePreRegistration,isSafeNotificationRoute,notificationBadge} from "../lib/notifications/policy.ts";

test("pré-cadastro geral notifica somente vínculos no alcance da Convenção",()=>{
  const target={conventionId:null,matrixId:null,branchId:null};
  assert.equal(canReceivePreRegistration("CONVENCAO",10,target),true);
  assert.equal(canReceivePreRegistration("MATRIZ",20,target),false);
  assert.equal(canReceivePreRegistration("FILIAL",30,target),false);
});

test("alcance do pré-cadastro segue Convenção, Matriz e Filial",()=>{
  const branchTarget={conventionId:10,matrixId:20,branchId:30};
  assert.equal(canReceivePreRegistration("CONVENCAO",10,branchTarget),true);
  assert.equal(canReceivePreRegistration("CONVENCAO",11,branchTarget),false);
  assert.equal(canReceivePreRegistration("MATRIZ",20,branchTarget),true);
  assert.equal(canReceivePreRegistration("MATRIZ",21,branchTarget),false);
  assert.equal(canReceivePreRegistration("FILIAL",30,branchTarget),true);
  assert.equal(canReceivePreRegistration("FILIAL",31,branchTarget),false);
  assert.equal(canReceivePreRegistration("FILIAL",30,{...branchTarget,branchId:null}),false);
});

test("ações aceitam somente rotas internas do painel",()=>{
  for(const route of [null,"/painel","/painel/membros/pre-cadastros?abrir=42"])assert.equal(isSafeNotificationRoute(route),true);
  for(const route of ["https://example.com","//example.com","/login","javascript:alert(1)"])assert.equal(isSafeNotificationRoute(route),false);
});

test("badge é limitado a 99+",()=>{
  assert.equal(notificationBadge(0),"0");
  assert.equal(notificationBadge(99),"99");
  assert.equal(notificationBadge(100),"99+");
  assert.equal(notificationBadge(-2),"0");
});

import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_REPORT_BLOCKS, normalizeReportBlocks, publicContributorName, reportBalances } from "../lib/finance/report-policy.ts";

test("saldo livre desconta recurso vinculado e somente o rateio ainda não repassado",()=>{
  const result=reportBalances({openingCents:500_000,entriesCents:1_600_000,expensesCents:250_000,linkedCents:300_000,calculatedAllocationCents:1_000_000,transferredAllocationCents:400_000});
  assert.deepEqual(result,{currentCents:1_850_000,remainingTransferCents:600_000,freeCents:950_000});
});

test("parcela própria não vira obrigação e despesas reduzem o saldo livre uma única vez",()=>{
  const before=reportBalances({openingCents:0,entriesCents:1_000_000,expensesCents:0,linkedCents:0,calculatedTransferCents:700_000,transferredAllocationCents:0});
  assert.deepEqual(before,{currentCents:1_000_000,remainingTransferCents:700_000,freeCents:300_000});
  const afterExpense=reportBalances({openingCents:0,entriesCents:1_000_000,expensesCents:50_000,linkedCents:0,calculatedTransferCents:700_000,transferredAllocationCents:0});
  assert.deepEqual(afterExpense,{currentCents:950_000,remainingTransferCents:700_000,freeCents:250_000});
  const afterTransfer=reportBalances({openingCents:0,entriesCents:1_000_000,expensesCents:200_000,linkedCents:0,calculatedTransferCents:700_000,transferredAllocationCents:200_000});
  assert.deepEqual(afterTransfer,{currentCents:800_000,remainingTransferCents:500_000,freeCents:300_000});
});

test("privacidade pública nunca expõe contribuinte privado",()=>{
  assert.equal(publicContributorName("IDENTIFICADA","Maria Silva"),"Maria Silva");
  assert.equal(publicContributorName("IDENTIFICADA_PRIVADA","Maria Silva"),"Anônimo");
  assert.equal(publicContributorName("ANONIMA",null),"Anônimo");
});

test("editor aceita apenas blocos controlados e recompõe ausentes",()=>{
  const blocks=normalizeReportBlocks([{key:"ENTRADAS",label:"Receitas",visible:true},{key:"SQL",label:"DROP TABLE",visible:true}]);
  assert.equal(blocks.find(item=>item.key==="ENTRADAS")?.label,"Receitas");
  assert.equal(blocks.some(item=>(item as {key:string}).key==="SQL"),false);
  assert.equal(blocks.length,DEFAULT_REPORT_BLOCKS.length);
});

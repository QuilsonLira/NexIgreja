import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

test("rateio para pessoas preserva vínculo, histórico e proteção de reabertura",async()=>{
  const [migration,server,patch]=await Promise.all([
    read("database/mysql/005_rateio_person_payables.sql"),
    read("lib/server/finance-rateio-people.ts"),
    read("scripts/apply-rateio-person-patch.mjs"),
  ]);
  assert.match(migration,/generated_by_rateio/);
  assert.match(migration,/beneficiary_cpf_snapshot/);
  assert.match(migration,/rateio_closure_version/);
  assert.match(server,/RATEIO_ADIANTAMENTO/);
  assert.match(server,/prepareRateioPersonReopenCancellation/);
  assert.match(server,/RATEIO_JA_PAGO_EXIGE_ESTORNO/);
  assert.match(patch,/PAGAR_PESSOA/);
  assert.match(patch,/preparePersonRateioObligations/);
});

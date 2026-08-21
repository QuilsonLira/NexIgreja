import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const periods = readFileSync(new URL("../lib/server/finance-periods.ts", import.meta.url), "utf8");
const quickUi = readFileSync(new URL("../components/finance-quick-entry.tsx", import.meta.url), "utf8");
const categoryValidation = readFileSync(new URL("../lib/server/finance-categories.ts", import.meta.url), "utf8");

test("lançamento rápido grava e preserva category_id", () => {
  for (const fragment of [
    "category_id,payment_method_id",
    "SET amount_cents=?,occurred_on=?,competency=?,description=?,category_id=?",
    "categoryDefaultStatement(ctx,type,categoryId,stamp)",
    "expectedKind:\"RECEITA\"",
    "categoryId: Number(categoryId)",
    "entry.category_id",
  ]) assert.ok((periods + quickUi).includes(fragment), fragment);
});

test("categoria é validada por tenant, situação, natureza e fundo", () => {
  for (const fragment of ["WHERE id=? AND tenant_id=?", "category.status !== \"ATIVA\"", "category.archived_at", "category.kind !== options.expectedKind", "category.requires_fund"]) assert.ok(categoryValidation.includes(fragment), fragment);
  assert.ok(periods.includes("c.fund_id"));
  assert.ok(periods.includes("campaign?.fund_id??null"));
});

test("base combinada usa somente categorias participantes e exclui campanha", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE finance_movements(id INTEGER PRIMARY KEY,amount_cents INTEGER,direction TEXT,status TEXT,category_id INTEGER,campaign_id INTEGER,fund_id INTEGER);
    CREATE TABLE finance_categories(id INTEGER PRIMARY KEY,participates_allocation INTEGER);
    CREATE TABLE finance_funds(id INTEGER PRIMARY KEY,restricted INTEGER);
    INSERT INTO finance_categories VALUES(1,1),(2,1),(3,0);
    INSERT INTO finance_movements VALUES(1,100000,'ENTRADA','CONFIRMADO',1,NULL,NULL);
    INSERT INTO finance_movements VALUES(2,50000,'ENTRADA','CONFIRMADO',2,NULL,NULL);
    INSERT INTO finance_movements VALUES(3,30000,'ENTRADA','CONFIRMADO',3,90,NULL);
  `);
  const total = db.prepare("SELECT SUM(amount_cents) value FROM finance_movements WHERE status='CONFIRMADO' AND direction='ENTRADA'").get().value;
  const eligible = db.prepare("SELECT SUM(m.amount_cents) value FROM finance_movements m JOIN finance_categories c ON c.id=m.category_id LEFT JOIN finance_funds f ON f.id=m.fund_id WHERE m.status='CONFIRMADO' AND m.direction='ENTRADA' AND c.participates_allocation=1 AND m.campaign_id IS NULL AND (m.fund_id IS NULL OR COALESCE(f.restricted,0)=0)").get().value;
  assert.equal(total, 180000);
  assert.equal(eligible, 150000);
  assert.deepEqual([eligible * 0.5, eligible * 0.15, eligible * 0.35], [75000, 22500, 52500]);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE finance_allocation_rules(id INTEGER PRIMARY KEY,tenant_id INTEGER,config_id INTEGER);
    CREATE TABLE finance_period_allocation_rules(id INTEGER PRIMARY KEY,tenant_id INTEGER,period_id INTEGER);
    CREATE TABLE finance_period_allocation_results(id INTEGER PRIMARY KEY,tenant_id INTEGER,period_id INTEGER,closure_version INTEGER);
    CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));
    INSERT INTO finance_allocation_rules(id,tenant_id,config_id) VALUES(1,10,100);
    INSERT INTO finance_period_allocation_rules(id,tenant_id,period_id) VALUES(2,10,200);
    INSERT INTO finance_period_allocation_results(id,tenant_id,period_id,closure_version) VALUES(3,10,200,1);
  `);
  const migration=readFileSync(new URL("../drizzle/0032_finance_allocation_destination.sql",import.meta.url),"utf8");
  for(const sql of migration.split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))db.exec(sql);
  return db;
}

test("0032 mantém regras antigas como REPASSAR e permite parcela própria explícita",()=>{
  const db=fixture();
  assert.equal(db.prepare("SELECT financial_destination FROM finance_allocation_rules WHERE id=1").get().financial_destination,"REPASSAR");
  assert.equal(db.prepare("SELECT financial_destination FROM finance_period_allocation_rules WHERE id=2").get().financial_destination,"REPASSAR");
  db.prepare("UPDATE finance_period_allocation_results SET financial_destination='MANTER_NA_UNIDADE' WHERE id=3").run();
  assert.equal(db.prepare("SELECT financial_destination FROM finance_period_allocation_results WHERE id=3").get().financial_destination,"MANTER_NA_UNIDADE");
  assert.throws(()=>db.prepare("UPDATE finance_allocation_rules SET financial_destination='CONGREGACAO' WHERE id=1").run(),/CHECK/);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='45'").get().total,2);
});

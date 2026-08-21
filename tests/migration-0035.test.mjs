import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

function migrated() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE finance_allocation_rules(id INTEGER PRIMARY KEY);
CREATE TABLE finance_period_allocation_rules(id INTEGER PRIMARY KEY);
CREATE TABLE finance_period_allocation_results(id INTEGER PRIMARY KEY);
CREATE TABLE organizational_units(id INTEGER NOT NULL,tenant_id INTEGER NOT NULL,name TEXT,type TEXT,status TEXT,archived_at TEXT,parent_id INTEGER,UNIQUE(id,tenant_id));
CREATE TABLE departments(id INTEGER NOT NULL,tenant_id INTEGER NOT NULL,unit_id INTEGER,status TEXT,UNIQUE(id,tenant_id));
CREATE TABLE auth_users(id INTEGER PRIMARY KEY);
CREATE TABLE finance_periods(id INTEGER NOT NULL,tenant_id INTEGER NOT NULL,UNIQUE(id,tenant_id));
CREATE TABLE finance_accounts(id INTEGER NOT NULL,tenant_id INTEGER NOT NULL,UNIQUE(id,tenant_id));
CREATE TABLE finance_movements(id INTEGER NOT NULL,tenant_id INTEGER NOT NULL,UNIQUE(id,tenant_id));
CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));`);
  for (const sql of readFileSync(
    new URL("../drizzle/0035_finance_interunit_repasses.sql", import.meta.url),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean))
    db.exec(sql);
  return db;
}

test("migração cria repasse vinculado ao fechamento e histórico de eventos", () => {
  const db = migrated();
  db.exec(
    "INSERT INTO organizational_units VALUES(10,1,'Filial','FILIAL','ATIVO',NULL,20),(20,1,'Matriz','MATRIZ','ATIVO',NULL,30); INSERT INTO auth_users VALUES(7); INSERT INTO finance_periods VALUES(40,1); INSERT INTO finance_accounts VALUES(50,1); INSERT INTO finance_movements VALUES(60,1);",
  );
  db.prepare(
    "INSERT INTO finance_interunit_repasses(id,tenant_id,period_id,closure_version,rule_display_order,source_unit_id,destination_unit_id,payer_unit_id,receiver_unit_id,recipient_name,competency,expected_cents,created_by_user_id,created_at,updated_at) VALUES(1,1,40,1,1,10,20,10,20,'Matriz','2026-08',150000,7,'x','x')",
  ).run();
  db.prepare(
    "INSERT INTO finance_interunit_repass_events(id,tenant_id,repass_id,event_type,amount_cents,account_id,movement_id,occurred_on,actor_user_id,created_at) VALUES(2,1,1,'ENVIO',130000,50,60,'2026-08-17',7,'x')",
  ).run();
  assert.equal(
    db
      .prepare(
        "SELECT expected_cents,status FROM finance_interunit_repasses WHERE id=1",
      )
      .get().expected_cents,
    150000,
  );
  assert.equal(
    db
      .prepare(
        "SELECT event_type FROM finance_interunit_repass_events WHERE repass_id=1",
      )
      .get().event_type,
    "ENVIO",
  );
});

test("migração protege valores e evita repasse duplicado na mesma versão", () => {
  const db = migrated();
  db.exec(
    "INSERT INTO organizational_units VALUES(10,1,'Filial','FILIAL','ATIVO',NULL,20),(20,1,'Matriz','MATRIZ','ATIVO',NULL,30); INSERT INTO auth_users VALUES(7); INSERT INTO finance_periods VALUES(40,1);",
  );
  const insert = db.prepare(
    "INSERT INTO finance_interunit_repasses(id,tenant_id,period_id,closure_version,rule_display_order,source_unit_id,destination_unit_id,payer_unit_id,receiver_unit_id,recipient_name,competency,expected_cents,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,1,10,20,10,20,'Matriz','2026-08',150000,7,'x','x')",
  );
  insert.run(1, 1, 40, 1);
  assert.throws(() => insert.run(2, 1, 40, 1), /UNIQUE/);
  assert.throws(
    () =>
      db.exec("UPDATE finance_interunit_repasses SET sent_cents=-1 WHERE id=1"),
    /CHECK/,
  );
});

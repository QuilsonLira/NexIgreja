import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE tenants(id INTEGER PRIMARY KEY);
    CREATE TABLE organizational_units(id INTEGER PRIMARY KEY,tenant_id INTEGER,UNIQUE(id,tenant_id));
    CREATE TABLE auth_users(id INTEGER PRIMARY KEY);
    CREATE TABLE tenant_memberships(id INTEGER PRIMARY KEY,status TEXT,archived_at TEXT);
    CREATE TABLE membership_permissions(membership_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(membership_id,permission));
    CREATE TABLE platform_owners(user_id INTEGER);
    CREATE TABLE user_permissions(user_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(user_id,permission));
    CREATE TABLE finance_periods(id INTEGER PRIMARY KEY,tenant_id INTEGER,UNIQUE(id,tenant_id));
    CREATE TABLE finance_closure_versions(id INTEGER PRIMARY KEY,tenant_id INTEGER,UNIQUE(id,tenant_id));
    CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));
  `);
  for(const sql of readFileSync(new URL("../drizzle/0029_finance_reports_stage_four.sql",import.meta.url),"utf8").split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))db.exec(sql);
  return db;
}

test("0029 cria modelos, versões e snapshots imutáveis de relatórios",()=>{
  const db=fixture();
  for(const table of ["finance_report_models","finance_report_model_versions","finance_reports"])assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table),table);
  const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(row=>row.name);
  assert.ok(indexes.includes("finance_reports_history_idx"));
  assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='40'").get().total,24);
});

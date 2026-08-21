import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE auth_users(id INTEGER PRIMARY KEY);
    CREATE TABLE finance_campaigns(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,unit_id INTEGER NOT NULL,fund_id INTEGER,name TEXT,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE finance_funds(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,unit_id INTEGER NOT NULL,name TEXT,restricted INTEGER,status TEXT,created_at TEXT,updated_at TEXT);
    CREATE TABLE finance_movements(id INTEGER PRIMARY KEY,tenant_id INTEGER NOT NULL,unit_id INTEGER NOT NULL,period_id INTEGER,campaign_id INTEGER,fund_id INTEGER,status TEXT,direction TEXT,occurred_on TEXT);
    CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));
  `);
  for(const sql of readFileSync(new URL("../drizzle/0030_finance_stage_five_adjustments.sql",import.meta.url),"utf8").split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))db.exec(sql);
  return db;
}

test("0030 adiciona metadados seguros, índices por período e ajuda",()=>{
  assert.ok(readFileSync(new URL("../drizzle/0030_finance_stage_five_adjustments.sql",import.meta.url),"utf8").includes("INSERT OR IGNORE INTO `help_articles`"));
  const db=fixture();
  const campaignColumns=db.prepare("PRAGMA table_info(finance_campaigns)").all().map(row=>row.name);
  const fundColumns=db.prepare("PRAGMA table_info(finance_funds)").all().map(row=>row.name);
  for(const column of ["archived_at","archived_by_user_id","archive_reason"])assert.ok(campaignColumns.includes(column),column);
  for(const column of ["description","purpose","archived_at","archived_by_user_id","archive_reason"])assert.ok(fundColumns.includes(column),column);
  const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(row=>row.name);
  for(const index of ["finance_movements_period_page_idx","finance_movements_period_status_idx","finance_movements_campaign_period_idx","finance_movements_fund_period_idx"])assert.ok(indexes.includes(index),index);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='41'").get().total,13);
});

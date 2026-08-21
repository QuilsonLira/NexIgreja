import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function fixture(){const db=new DatabaseSync(":memory:");db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE organizational_units(id INTEGER PRIMARY KEY,tenant_id INTEGER,UNIQUE(id,tenant_id));
CREATE TABLE auth_users(id INTEGER PRIMARY KEY);
CREATE TABLE finance_allocation_configs(id INTEGER PRIMARY KEY,tenant_id INTEGER,unit_id INTEGER,UNIQUE(id,tenant_id));
CREATE TABLE finance_periods(id INTEGER PRIMARY KEY,tenant_id INTEGER,unit_id INTEGER,UNIQUE(id,tenant_id));
CREATE TABLE finance_closure_versions(id INTEGER PRIMARY KEY,tenant_id INTEGER,period_id INTEGER,version INTEGER,total_entries_cents INTEGER,total_expenses_cents INTEGER,restricted_resources_cents INTEGER,balance_cents INTEGER,movement_count INTEGER,rules_snapshot_json TEXT,totals_snapshot_json TEXT,closed_by_user_id INTEGER,closed_at TEXT);
CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));`);for(const sql of readFileSync(new URL("../drizzle/0028_finance_allocation_stage_three.sql",import.meta.url),"utf8").split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))db.exec(sql);return db;}

test("0028 preserva versões, resultados e dados de fechamento do rateio",()=>{const db=fixture();for(const table of ["finance_allocation_config_versions","finance_period_allocation_rule_versions","finance_period_allocation_results"])assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table),table);const columns=db.prepare("PRAGMA table_info(finance_closure_versions)").all().map(row=>row.name);for(const column of ["eligible_base_cents","excluded_resources_cents","allocated_cents","unallocated_cents","allocation_results_json"])assert.ok(columns.includes(column),column);assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='39'").get().total,15);});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE tenants(id INTEGER PRIMARY KEY);
    CREATE TABLE auth_users(id INTEGER PRIMARY KEY);
    CREATE TABLE finance_categories(id INTEGER NOT NULL,tenant_id INTEGER NOT NULL,name TEXT,kind TEXT,status TEXT,participates_allocation INTEGER,requires_fund INTEGER,PRIMARY KEY(id,tenant_id));
    CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));
    INSERT INTO tenants(id) VALUES(1),(2);
    INSERT INTO auth_users(id) VALUES(10);
    INSERT INTO finance_categories(id,tenant_id,name,kind,status,participates_allocation,requires_fund) VALUES(100,1,'Dízimos','RECEITA','ATIVA',1,0),(100,2,'Ofertas','RECEITA','ATIVA',1,0);
  `);
  const migration = readFileSync(new URL("../drizzle/0031_finance_quick_category_defaults.sql", import.meta.url), "utf8");
  for (const sql of migration.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(sql);
  return db;
}

test("0031 cria associação de categoria por tipo e por tenant", () => {
  const db = fixture();
  db.prepare("INSERT INTO finance_contribution_category_defaults(tenant_id,contribution_type,category_id,created_by_user_id,updated_by_user_id,created_at,updated_at) VALUES(1,'DIZIMO',100,10,10,'agora','agora')").run();
  assert.equal(db.prepare("SELECT category_id FROM finance_contribution_category_defaults WHERE tenant_id=1 AND contribution_type='DIZIMO'").get().category_id, 100);
  assert.throws(() => db.prepare("INSERT INTO finance_contribution_category_defaults(tenant_id,contribution_type,category_id,created_by_user_id,updated_by_user_id,created_at,updated_at) VALUES(1,'OFERTA',999,10,10,'agora','agora')").run(), /FOREIGN KEY/);
  assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE slug='financeiro-categorias-lancamento-rapido'").get().total, 1);
});

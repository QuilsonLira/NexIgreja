import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function apply(db,name){for(const sql of readFileSync(new URL(`../drizzle/${name}.sql`,import.meta.url),"utf8").split("--> statement-breakpoint").map(value=>value.trim()).filter(Boolean))db.exec(sql);}
function fixture(){const db=new DatabaseSync(":memory:");db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE tenants(id INTEGER PRIMARY KEY);
CREATE TABLE organizational_units(id INTEGER PRIMARY KEY,tenant_id INTEGER,type TEXT,name TEXT,parent_id INTEGER,status TEXT,archived_at TEXT,UNIQUE(id,tenant_id));
CREATE TABLE organizational_functions(id INTEGER PRIMARY KEY,tenant_id INTEGER,name TEXT,status TEXT,UNIQUE(id,tenant_id));
CREATE TABLE auth_users(id INTEGER PRIMARY KEY,status TEXT,archived_at TEXT);
CREATE TABLE tenant_memberships(id INTEGER PRIMARY KEY,user_id INTEGER,tenant_id INTEGER,display_name TEXT,role_name TEXT,scope TEXT,scope_unit_id INTEGER,status TEXT,archived_at TEXT,UNIQUE(id,tenant_id));
CREATE TABLE membership_permissions(membership_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(membership_id,permission));
CREATE TABLE user_permissions(user_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(user_id,permission));
CREATE TABLE platform_owners(singleton_id INTEGER PRIMARY KEY,user_id INTEGER);
CREATE TABLE people(id INTEGER PRIMARY KEY,tenant_id INTEGER,member_number INTEGER,full_name TEXT,status TEXT,matrix_id INTEGER,branch_id INTEGER,birth_date TEXT,sex TEXT,cpf TEXT,phone TEXT,whatsapp TEXT,linked_auth_user_id INTEGER,UNIQUE(id,tenant_id));
CREATE TABLE help_articles(id INTEGER PRIMARY KEY,tenant_id INTEGER,slug TEXT,title TEXT,summary TEXT,content TEXT,category TEXT,display_order INTEGER,target_profiles TEXT,required_permission TEXT,related_route TEXT,published INTEGER,is_new_feature INTEGER,released_at TEXT,version TEXT,created_by_user_id INTEGER,published_at TEXT,created_at TEXT,updated_at TEXT,UNIQUE(tenant_id,slug));
CREATE TABLE help_article_reads(user_id INTEGER,article_id INTEGER,viewed_at TEXT,PRIMARY KEY(user_id,article_id));
INSERT INTO tenants VALUES(1),(2),(1770000000000000);
INSERT INTO organizational_units VALUES(10,1,'CONVENCAO','Convenção A',NULL,'ATIVO',NULL),(20,1,'MATRIZ','Matriz A',10,'ATIVO',NULL),(30,1,'FILIAL','Filial A',20,'ATIVO',NULL),(110,2,'CONVENCAO','Convenção B',NULL,'ATIVO',NULL),(120,2,'MATRIZ','Matriz B',110,'ATIVO',NULL);
INSERT INTO organizational_functions VALUES(80,1,'Pastor','ATIVO'),(180,2,'Pastor','ATIVO');
INSERT INTO auth_users VALUES(1,'ATIVO',NULL),(2,'ATIVO',NULL),(3,'ATIVO',NULL),(4,'ATIVO',NULL);
INSERT INTO tenant_memberships VALUES(1,1,1,'Admin Convenção','Administrador da Convenção','CONVENCAO',10,'ATIVO',NULL),(2,2,2,'Admin B','Administrador da Convenção','CONVENCAO',110,'ATIVO',NULL),(3,3,1,'Admin Matriz','Administrador da Matriz','MATRIZ',20,'ATIVO',NULL),(4,4,1,'Somente leitura','Leitor','FILIAL',30,'ATIVO',NULL);
INSERT INTO people VALUES(1001,1,1,'Pessoa A','MEMBRO_ATIVO',20,NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2001,2,1,'Pessoa B','MEMBRO_ATIVO',120,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO platform_owners VALUES(1,1);`);apply(db,"0019_departments_ebd");apply(db,"0022_finance_core");apply(db,"0023_finance_periods_and_quick_entry");apply(db,"0025_finance_quick_entry_corrections");apply(db,"0026_finance_account_category_management");return db;}

test("0026 adiciona metadados, arquivamento e ajustes sem recriar tabelas",()=>{const db=fixture();const expected={finance_accounts:["description","agency","account_number","pix_key","notes","archived_at","archived_by_user_id"],finance_categories:["description","archived_at","archived_by_user_id"],finance_payment_methods:["description","archived_at","archived_by_user_id"],finance_cost_centers:["description","archived_at","archived_by_user_id"],finance_movements:["adjustment_direction"]};for(const [table,names] of Object.entries(expected)){const columns=db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name);for(const name of names)assert.ok(columns.includes(name),`${table}.${name}`);}for(const name of ["finance_payment_methods_filter_idx","finance_cost_centers_filter_idx"])assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name),name);});

test("ajuste positivo e negativo preserva saldo calculado e histórico",()=>{const db=fixture();db.exec(`INSERT INTO finance_accounts(id,tenant_id,unit_id,name,account_type,initial_balance_cents,initial_balance_date,status,created_by_user_id,created_at,updated_at) VALUES(500,1,20,'Banco','CONTA_CORRENTE',100000,'2026-08-01','ATIVA',3,'2026-08-01','2026-08-01');
INSERT INTO finance_movements(id,tenant_id,unit_id,account_id,direction,adjustment_direction,amount_cents,occurred_on,competency,description,source,privacy,status,created_by_user_id,created_at,updated_at) VALUES(600,1,20,500,'AJUSTE','ENTRADA',5000,'2026-08-14','2026-08','Ajuste positivo','OUTRO','IDENTIFICADA_PRIVADA','CONFIRMADO',3,'2026-08-14','2026-08-14'),(601,1,20,500,'AJUSTE','SAIDA',2000,'2026-08-14','2026-08','Ajuste negativo','OUTRO','IDENTIFICADA_PRIVADA','CONFIRMADO',3,'2026-08-14','2026-08-14');`);const balance=db.prepare("SELECT a.initial_balance_cents+SUM(CASE WHEN m.direction='AJUSTE' AND m.adjustment_direction='ENTRADA' THEN m.amount_cents WHEN m.direction='AJUSTE' AND m.adjustment_direction='SAIDA' THEN -m.amount_cents ELSE 0 END) value FROM finance_accounts a JOIN finance_movements m ON m.account_id=a.id AND m.tenant_id=a.tenant_id WHERE a.id=500 GROUP BY a.id").get().value;assert.equal(balance,103000);assert.equal(db.prepare("SELECT COUNT(*) total FROM finance_movements WHERE account_id=500").get().total,2);});

test("ajuda financeira fica visível aos perfis válidos e pesquisável",()=>{const db=fixture();assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='37'").get().total,16);assert.equal(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='37' AND target_profiles='[\"TODOS\"]'").get().total,16);for(const term of ["saldo negativo","arquivar","reativar","categoria","ajuste de saldo"])assert.ok(db.prepare("SELECT COUNT(*) total FROM help_articles WHERE version='37' AND lower(title||' '||summary||' '||content) LIKE ?").get(`%${term}%`).total>0,term);});

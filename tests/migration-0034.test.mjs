import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../drizzle/0034_finance_reopen_request_workflow.sql", import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE finance_periods(id INTEGER PRIMARY KEY);
    CREATE TABLE tenant_memberships(id INTEGER PRIMARY KEY,user_id INTEGER,scope TEXT,status TEXT,archived_at TEXT);
    CREATE TABLE membership_permissions(membership_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(membership_id,permission));
    CREATE TABLE platform_owners(user_id INTEGER PRIMARY KEY);
    CREATE TABLE user_permissions(user_id INTEGER,permission TEXT,created_at TEXT,PRIMARY KEY(user_id,permission));
    CREATE TABLE help_articles(slug TEXT PRIMARY KEY,title TEXT,summary TEXT,content TEXT,required_permission TEXT,related_route TEXT,published INTEGER,version TEXT,updated_at TEXT);
    INSERT INTO tenant_memberships VALUES (1,101,'MATRIZ','ATIVO',NULL),(2,102,'FILIAL','ATIVO',NULL),(3,103,'MATRIZ','ATIVO',NULL);
    INSERT INTO membership_permissions VALUES
      (1,'FINANCEIRO_CAIXA_ABRIR','antes'),(1,'FINANCEIRO_CAIXA_FECHAR','antes'),(1,'FINANCEIRO_CONFIGURAR','antes'),
      (2,'FINANCEIRO_VISUALIZAR','antes'),(3,'FINANCEIRO_CAIXA_ABRIR','antes');
    INSERT INTO platform_owners VALUES (999);
    INSERT INTO help_articles VALUES ('financeiro-reabrir-caixa','','','','','',0,'46','antes');
  `);
  db.exec(migration);
  return db;
}

test("0034 cria autorização vinculada ao usuário, caixa e versão", () => {
  const db = fixture();
  const columns = db.prepare("PRAGMA table_info(finance_period_reopen_requests)").all().map(row => row.name);
  for (const column of ["period_id","requester_user_id","requester_membership_id","requested_closure_version","status","expires_at","used_at"]) assert.ok(columns.includes(column));
});

test("0034 recupera os perfis existentes por escopo", () => {
  const db = fixture();
  assert.ok(db.prepare("SELECT 1 FROM membership_permissions WHERE membership_id=1 AND permission='FINANCEIRO_CAIXA_REABRIR'").get());
  assert.ok(db.prepare("SELECT 1 FROM membership_permissions WHERE membership_id=1 AND permission='FINANCEIRO_CAIXA_REABERTURA_APROVAR'").get());
  assert.ok(db.prepare("SELECT 1 FROM membership_permissions WHERE membership_id=2 AND permission='FINANCEIRO_CAIXA_REABERTURA_SOLICITAR'").get());
  assert.equal(db.prepare("SELECT 1 FROM membership_permissions WHERE membership_id=3 AND permission='FINANCEIRO_CAIXA_REABRIR'").get(), undefined);
  assert.ok(db.prepare("SELECT 1 FROM user_permissions WHERE user_id=999 AND permission='FINANCEIRO_CAIXA_REABRIR'").get());
});

test("0034 impede duas autorizações ativas para o mesmo fechamento", () => {
  const db = fixture();
  db.exec("INSERT INTO finance_periods VALUES (10)");
  const insert = db.prepare("INSERT INTO finance_period_reopen_requests(id,tenant_id,period_id,unit_id,matrix_id,branch_id,requester_user_id,requester_membership_id,requested_closure_version,reason,status,requested_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  insert.run(1,1,10,20,30,20,102,2,4,"correção necessária","PENDENTE","agora","agora","agora");
  assert.throws(() => insert.run(2,1,10,20,30,20,102,2,4,"outra correção","APROVADA","agora","agora","agora"));
});

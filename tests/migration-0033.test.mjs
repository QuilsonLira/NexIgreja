import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../drizzle/0033_finance_period_reopen_permission_backfill.sql", import.meta.url), "utf8")
  .replaceAll("--> statement-breakpoint", "");

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE tenant_memberships (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      archived_at TEXT,
      scope TEXT NOT NULL
    );
    CREATE TABLE membership_permissions (
      membership_id INTEGER NOT NULL,
      permission TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (membership_id, permission)
    );
    CREATE TABLE help_articles (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT,
      summary TEXT,
      content TEXT,
      required_permission TEXT,
      related_route TEXT,
      published INTEGER,
      version TEXT,
      updated_at TEXT
    );

    INSERT INTO tenant_memberships(id,status,archived_at,scope) VALUES
      (1,'ATIVO',NULL,'CONVENCAO'),
      (2,'ATIVO',NULL,'MATRIZ'),
      (3,'ATIVO',NULL,'FILIAL'),
      (4,'ATIVO',NULL,'MATRIZ'),
      (5,'INATIVO',NULL,'MATRIZ');

    INSERT INTO membership_permissions(membership_id,permission,created_at)
    SELECT id, permission, 'antes'
    FROM tenant_memberships
    CROSS JOIN (
      SELECT 'FINANCEIRO_CAIXA_ABRIR' permission
      UNION ALL SELECT 'FINANCEIRO_CAIXA_FECHAR'
      UNION ALL SELECT 'FINANCEIRO_CONFIGURAR'
    )
    WHERE id IN (1,2,3,5);

    INSERT INTO membership_permissions VALUES
      (4,'FINANCEIRO_CAIXA_ABRIR','antes'),
      (4,'FINANCEIRO_CAIXA_FECHAR','antes');

    INSERT INTO help_articles(id,slug,title,summary,content,required_permission,related_route,published,version,updated_at)
    VALUES (1,'financeiro-reabrir-caixa','Antigo','','','','',0,'34','antes');
  `);
  db.exec(migration);
  return db;
}

test("0033 recupera a permissão somente para perfis administrativos elegíveis", () => {
  const db = fixture();
  const memberships = db.prepare("SELECT membership_id FROM membership_permissions WHERE permission='FINANCEIRO_CAIXA_REABRIR' ORDER BY membership_id").all().map((row) => row.membership_id);
  assert.deepEqual(memberships, [1, 2]);
});

test("0033 publica o passo a passo com histórico v1/v2", () => {
  const db = fixture();
  const article = db.prepare("SELECT * FROM help_articles WHERE slug='financeiro-reabrir-caixa'").get();
  assert.equal(article.published, 1);
  assert.equal(article.required_permission, "FINANCEIRO_CAIXA_REABRIR");
  for (const text of ["Financeiro > Caixa", "Reabrir Caixa", "senha", "motivo", "v1", "v2"]) assert.match(article.content, new RegExp(text, "i"));
});

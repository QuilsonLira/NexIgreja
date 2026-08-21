import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function migrationDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE tenants (id INTEGER PRIMARY KEY);
    CREATE TABLE organizational_units (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      type TEXT NOT NULL,
      cnpj TEXT,
      parent_id INTEGER REFERENCES organizational_units(id)
    );
    CREATE UNIQUE INDEX organizational_units_cnpj_unique ON organizational_units(cnpj) WHERE cnpj IS NOT NULL;
    CREATE TABLE tenant_memberships (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      role_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE membership_permissions (membership_id INTEGER NOT NULL, permission TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (membership_id, permission));
    CREATE TABLE user_permissions (user_id INTEGER NOT NULL, permission TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, permission));
    INSERT INTO tenants VALUES (1), (2);
    INSERT INTO organizational_units VALUES (10, 1, 'MATRIZ', '11222333000181', NULL), (11, 1, 'FILIAL', NULL, 10);
    INSERT INTO tenant_memberships VALUES (100, 1, 'Pastor', '2026-01-01', '2026-01-01');
    INSERT INTO membership_permissions VALUES (100, 'USUARIOS_VISUALIZAR', '2026-01-01');
  `);
  const sql = readFileSync(new URL("../drizzle/0011_greedy_lady_mastermind.sql", import.meta.url), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) db.exec(statement);
  return db;
}

test("migration preserva função textual e cria permissões equivalentes", () => {
  const db = migrationDatabase();
  const membership = db.prepare("SELECT function_id FROM tenant_memberships WHERE id = 100").get();
  const organizationalFunction = db.prepare("SELECT tenant_id, name, status FROM organizational_functions WHERE id = ?").get(membership.function_id);
  assert.equal(organizationalFunction.tenant_id, 1);
  assert.equal(organizationalFunction.name, "Pastor");
  assert.equal(organizationalFunction.status, "ATIVO");
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM membership_permissions WHERE membership_id = 100 AND permission = 'FUNCOES_VISUALIZAR'").get().total, 1);
});

test("CNPJ herdado não é copiado, acompanha a matriz e mantém isolamento", () => {
  const db = migrationDatabase();
  db.exec("UPDATE organizational_units SET uses_parent_cnpj = 1 WHERE id = 11");
  const effective = () => db.prepare("SELECT CASE WHEN branch.uses_parent_cnpj = 1 THEN matrix.cnpj ELSE branch.cnpj END AS cnpj FROM organizational_units branch JOIN organizational_units matrix ON matrix.id = branch.parent_id AND matrix.tenant_id = branch.tenant_id WHERE branch.id = 11").get().cnpj;
  assert.equal(effective(), "11222333000181");
  db.exec("UPDATE organizational_units SET cnpj = '11444777000161' WHERE id = 10");
  assert.equal(effective(), "11444777000161");
  db.exec("INSERT INTO organizational_units (id, tenant_id, type, cnpj, parent_id) VALUES (20, 2, 'MATRIZ', '11444777000161', NULL)");
  db.exec("INSERT INTO organizational_units (id, tenant_id, type, cnpj, parent_id) VALUES (13, 1, 'FILIAL', '11222333000181', 10)");
  assert.throws(() => db.exec("INSERT INTO organizational_units (id, tenant_id, type, cnpj, parent_id) VALUES (12, 1, 'MATRIZ', '11444777000161', NULL)"), /UNIQUE/);
  assert.throws(() => db.exec("UPDATE organizational_units SET cnpj = '11222333000181' WHERE id = 11"), /CNPJ herdado/);
  db.exec("INSERT INTO organizational_units (id, tenant_id, type, cnpj, parent_id) VALUES (30, 2, 'MATRIZ', NULL, NULL), (31, 2, 'FILIAL', NULL, 30)");
  assert.throws(() => db.exec("UPDATE organizational_units SET uses_parent_cnpj = 1 WHERE id = 31"), /CNPJ herdado/);
});

test("trigger impede função de outro tenant no vínculo", () => {
  const db = migrationDatabase();
  db.exec("INSERT INTO organizational_functions VALUES (200, 2, 'Tesoureiro', 'tesoureiro', NULL, 'ATIVO', '2026-01-01', '2026-01-01')");
  assert.throws(() => db.exec("UPDATE tenant_memberships SET function_id = 200 WHERE id = 100"), /Função fora do tenant/);
});

test("catálogo permite mesmo nome em tenants distintos e preserva vínculo inativo", () => {
  const db = migrationDatabase();
  assert.throws(() => db.exec("INSERT INTO organizational_functions VALUES (201, 1, 'Pastor', 'pastor', NULL, 'ATIVO', '2026-01-01', '2026-01-01')"), /UNIQUE/);
  db.exec("INSERT INTO organizational_functions VALUES (202, 2, 'Pastor', 'pastor', NULL, 'ATIVO', '2026-01-01', '2026-01-01')");
  db.exec("UPDATE organizational_functions SET status = 'INATIVO' WHERE id = 100");
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM tenant_memberships WHERE function_id = 100").get().total, 1);
});

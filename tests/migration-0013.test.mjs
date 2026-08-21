import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE tenants (id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE auth_sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, tenant_id INTEGER, membership_id INTEGER, selected_unit_id INTEGER);
    CREATE TABLE platform_owners (singleton_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE);
    CREATE TRIGGER auth_sessions_tenant_required_insert BEFORE INSERT ON auth_sessions WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
    CREATE TRIGGER auth_sessions_tenant_required_update BEFORE UPDATE OF tenant_id ON auth_sessions WHEN NEW.tenant_id IS NULL BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
    INSERT INTO tenants VALUES (1, 'Igreja A', 'igreja-a', 'ATIVO', '2026-01-01', '2026-01-01'), (2, 'Igreja B', 'igreja-b', 'SUSPENSO', '2026-01-01', '2026-01-01');
    INSERT INTO platform_owners VALUES (1, 99);
    INSERT INTO auth_sessions (id, user_id, tenant_id, selected_unit_id) VALUES ('legacy-owner', 99, 1, 10);
  `);
  const sql = readFileSync(new URL("../drizzle/0013_institution_access_code.sql", import.meta.url), "utf8");
  db.exec("BEGIN");
  try {
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) db.exec(statement);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return db;
}

test("migration gera código único de 7 dígitos para tenants existentes", () => {
  const db = migratedDatabase();
  const rows = db.prepare("SELECT access_code FROM tenants ORDER BY id").all();
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.access_code)).size, 2);
  assert.ok(rows.every((row) => /^\d{7}$/.test(row.access_code)));
  assert.throws(() => db.exec("INSERT INTO tenants VALUES (3, 'C', 'c', '123', 'ATIVO', 'x', 'x')"), /exactly 7 digits/);
  assert.throws(() => db.prepare("UPDATE tenants SET access_code = ? WHERE id = 2").run(rows[0].access_code), /UNIQUE/);
});

test("contexto pré-login e estado do Platform Owner são estruturas distintas", () => {
  const db = migratedDatabase();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  assert.ok(tables.includes("tenant_access_contexts"));
  assert.ok(tables.includes("institution_lookup_attempts"));
  assert.deepEqual({ ...db.prepare("SELECT tenant_id, selected_unit_id, platform_context_active FROM auth_sessions WHERE id = 'legacy-owner'").get() }, { tenant_id: null, selected_unit_id: null, platform_context_active: 0 });
  db.exec("INSERT INTO auth_sessions (id, user_id, tenant_id) VALUES ('owner', 1, 1)");
  assert.equal(db.prepare("SELECT platform_context_active FROM auth_sessions WHERE id = 'owner'").get().platform_context_active, 0);
  db.exec("INSERT INTO auth_sessions (id, user_id, tenant_id) VALUES ('platform-only', 1, NULL)");
  assert.equal(db.prepare("SELECT tenant_id FROM auth_sessions WHERE id = 'platform-only'").get().tenant_id, null);
});

test("consulta tenant-aware não aceita senha ou usuário do tenant vizinho", () => {
  const db = migratedDatabase();
  db.exec("CREATE TABLE auth_users (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, cpf TEXT NOT NULL, password_hash TEXT NOT NULL, UNIQUE(tenant_id, cpf)); INSERT INTO auth_users VALUES (10, 1, '12345678900', 'senha-a'), (20, 2, '12345678900', 'senha-b')");
  const lookup = db.prepare("SELECT id, password_hash FROM auth_users WHERE tenant_id = ? AND cpf = ? LIMIT 1");
  assert.deepEqual({ ...lookup.get(1, "12345678900") }, { id: 10, password_hash: "senha-a" });
  assert.deepEqual({ ...lookup.get(2, "12345678900") }, { id: 20, password_hash: "senha-b" });
  assert.notEqual(lookup.get(1, "12345678900").password_hash, "senha-b");
});

test("rollback remove as estruturas novas e restaura a exigência legada de tenant na sessão", () => {
  const db = migratedDatabase();
  const down = readFileSync(new URL("../database/rollback/0013_institution_access_code.down.sql", import.meta.url), "utf8");
  db.exec(down);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  assert.equal(tables.includes("tenant_access_contexts"), false);
  assert.equal(tables.includes("institution_lookup_attempts"), false);
  const tenantColumns = db.prepare("PRAGMA table_info(tenants)").all().map((row) => row.name);
  const sessionColumns = db.prepare("PRAGMA table_info(auth_sessions)").all().map((row) => row.name);
  assert.equal(tenantColumns.includes("access_code"), false);
  assert.equal(sessionColumns.includes("platform_context_active"), false);
  assert.throws(() => db.exec("INSERT INTO auth_sessions (id, user_id, tenant_id) VALUES ('invalid', 3, NULL)"), /tenant_id is required/);
});

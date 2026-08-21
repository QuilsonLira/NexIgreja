import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

function migratedDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE tenants (id INTEGER PRIMARY KEY);
    CREATE TABLE organizational_units (id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id));
    CREATE TABLE auth_users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL,
      username TEXT COLLATE NOCASE NOT NULL CHECK (username = lower(username)),
      email TEXT COLLATE NOCASE NOT NULL CHECK (email = lower(email)),
      cpf TEXT NOT NULL, password_hash TEXT NOT NULL, role_name TEXT NOT NULL,
      scope TEXT NOT NULL, status TEXT NOT NULL, must_change_password INTEGER NOT NULL,
      failed_attempts INTEGER NOT NULL, blocked_until TEXT, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, archived_at TEXT, archived_by INTEGER,
      archived_previous_status TEXT, tenant_id INTEGER REFERENCES tenants(id)
    );
    CREATE UNIQUE INDEX auth_users_username_unique ON auth_users(username);
    CREATE UNIQUE INDEX auth_users_email_unique ON auth_users(email);
    CREATE UNIQUE INDEX auth_users_cpf_unique ON auth_users(cpf);
    CREATE TABLE platform_owners (singleton_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES auth_users(id));
    CREATE TABLE tenant_memberships (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES auth_users(id), tenant_id INTEGER NOT NULL REFERENCES tenants(id),
      display_name TEXT NOT NULL, role_name TEXT NOT NULL, scope TEXT NOT NULL, scope_unit_id INTEGER NOT NULL,
      status TEXT NOT NULL, accepted_at TEXT, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE user_profile_photos (user_id INTEGER PRIMARY KEY REFERENCES auth_users(id), image_data BLOB, mime_type TEXT, byte_size INTEGER, updated_at TEXT);
    CREATE TABLE user_permissions (user_id INTEGER, permission TEXT, created_at TEXT, PRIMARY KEY(user_id, permission));
    CREATE TABLE user_unit_links (user_id INTEGER, unit_id INTEGER, is_primary INTEGER, created_at TEXT, PRIMARY KEY(user_id, unit_id));
    CREATE TRIGGER user_unit_links_same_tenant_insert
    BEFORE INSERT ON user_unit_links
    WHEN EXISTS (SELECT 1 FROM auth_users user WHERE user.id = NEW.user_id AND user.tenant_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM auth_users user JOIN organizational_units unit ON unit.id = NEW.unit_id AND unit.tenant_id = user.tenant_id WHERE user.id = NEW.user_id)
    BEGIN SELECT RAISE(ABORT, 'user and unit belong to different tenants'); END;
    CREATE TABLE auth_sessions (id TEXT PRIMARY KEY, user_id INTEGER REFERENCES auth_users(id), membership_id INTEGER, tenant_id INTEGER);
    CREATE TABLE administration_audit (id INTEGER PRIMARY KEY, actor_user_id INTEGER REFERENCES auth_users(id), actor_membership_id INTEGER);
    INSERT INTO tenants VALUES (1), (2);
    INSERT INTO organizational_units VALUES (10, 1), (20, 2);
    INSERT INTO auth_users VALUES (7, 'Maria', 'maria', 'maria@exemplo.com', '52998224725', 'hash-a', 'Pastora', 'CONVENCAO', 'ATIVO', 0, 0, NULL, '2026-01-01', '2026-01-01', NULL, NULL, NULL, 1);
    INSERT INTO tenant_memberships VALUES
      (70, 7, 1, 'Maria A', 'Pastora', 'CONVENCAO', 10, 'ATIVO', '2026-01-01', NULL, '2026-01-01', '2026-01-01'),
      (71, 7, 2, 'Maria B', 'Tesoureira', 'MATRIZ', 20, 'PENDENTE', NULL, NULL, '2026-01-02', '2026-01-02');
    INSERT INTO auth_sessions VALUES ('session-b', 7, 71, 2);
  `);
  const sql = readFileSync(new URL("../drizzle/0012_tenant_owned_credentials.sql", import.meta.url), "utf8");
  db.exec("BEGIN");
  try {
    for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) db.exec(statement);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return db;
}

test("migration divide identidade compartilhada em credenciais próprias por tenant", () => {
  const db = migratedDatabase();
  const identities = db.prepare("SELECT id, tenant_id, username, password_hash FROM auth_users ORDER BY tenant_id").all();
  assert.equal(identities.length, 2);
  assert.deepEqual(identities.map((row) => row.tenant_id), [1, 2]);
  assert.equal(identities[0].password_hash, "hash-a");
  assert.equal(identities[1].password_hash, "hash-a");
  const tenantB = db.prepare("SELECT user_id, status FROM tenant_memberships WHERE tenant_id = 2").get();
  assert.notEqual(tenantB.user_id, 7);
  assert.equal(tenantB.status, "ATIVO");
  assert.equal(db.prepare("SELECT user_id FROM auth_sessions WHERE id = 'session-b'").get().user_id, tenantB.user_id);
});

test("mesmos identificadores são aceitos em tenants diferentes e recusados no mesmo tenant", () => {
  const db = migratedDatabase();
  db.prepare("UPDATE auth_users SET password_hash = 'senha-b' WHERE tenant_id = 2").run();
  assert.equal(db.prepare("SELECT password_hash FROM auth_users WHERE tenant_id = 1").get().password_hash, "hash-a");
  db.exec("INSERT INTO tenants VALUES (3)");
  db.prepare("INSERT INTO auth_users (id, name, username, email, cpf, password_hash, role_name, scope, status, must_change_password, failed_attempts, created_at, updated_at, tenant_id) VALUES (9, 'Maria C', 'maria', 'maria@exemplo.com', '52998224725', 'hash-c', 'Pastora', 'CONVENCAO', 'ATIVO', 0, 0, '2026-01-03', '2026-01-03', 3)").run();
  assert.doesNotThrow(() => db.prepare("INSERT INTO auth_users (id, name, username, email, cpf, password_hash, role_name, scope, status, must_change_password, failed_attempts, created_at, updated_at, tenant_id) VALUES (10, 'Outro nome', 'outro', 'outro@exemplo.com', '11144477735', 'hash', 'Pastor', 'CONVENCAO', 'ATIVO', 0, 0, '2026-01-03', '2026-01-03', 1)").run());
  assert.throws(() => db.prepare("INSERT INTO auth_users (id, name, username, email, cpf, password_hash, role_name, scope, status, must_change_password, failed_attempts, created_at, updated_at, tenant_id) VALUES (11, 'Duplicada', 'maria', 'nova@exemplo.com', '12345678909', 'hash', 'Pastor', 'CONVENCAO', 'ATIVO', 0, 0, '2026-01-03', '2026-01-03', 1)").run(), /UNIQUE/);
});

test("nome civil não possui restrição de unicidade", () => {
  const db = migratedDatabase();
  assert.doesNotThrow(() => db.prepare("INSERT INTO auth_users (id, name, username, email, cpf, password_hash, role_name, scope, status, must_change_password, failed_attempts, created_at, updated_at, tenant_id) VALUES (12, 'Maria A', 'maria.a2', 'maria.a2@exemplo.com', '11144477735', 'hash', 'Pastor', 'CONVENCAO', 'ATIVO', 0, 0, '2026-01-03', '2026-01-03', 1)").run());
});

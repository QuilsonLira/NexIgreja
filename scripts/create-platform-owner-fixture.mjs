import { rmSync } from "node:fs";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Usage: node scripts/create-platform-owner-fixture.mjs /tmp/platform-owner.sqlite");
}

rmSync(outputPath, { force: true });
const db = new DatabaseSync(outputPath);

try {
  db.exec(`
    CREATE TABLE auth_users (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER,
      name TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      cpf TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role_name TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      blocked_until TEXT,
      archived_at TEXT,
      archived_by INTEGER,
      archived_previous_status TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE platform_owners (
      singleton_id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const now = "2026-08-21T12:00:00.000Z";
  db.prepare(`
    INSERT INTO auth_users (
      id, tenant_id, name, username, email, cpf, password_hash, role_name, scope,
      status, must_change_password, failed_attempts, blocked_until, archived_at,
      archived_by, archived_previous_status, created_at, updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'ATIVO', 0, 0, NULL, NULL, NULL, NULL, ?, ?)
  `).run(
    1,
    "Platform Owner Fixture",
    "owner.fixture",
    "owner.fixture@example.invalid",
    "00000000000",
    "$2b$12$fixtureHashNotUsedForAuthentication000000000000000000000000",
    "Proprietário da Plataforma",
    "CONVENCAO",
    now,
    now,
  );

  db.prepare(
    "INSERT INTO platform_owners (singleton_id, user_id, created_at, updated_at) VALUES (1, 1, ?, ?)",
  ).run(now, now);

  console.log("PLATFORM_OWNER_FIXTURE_OK");
} finally {
  db.close();
}

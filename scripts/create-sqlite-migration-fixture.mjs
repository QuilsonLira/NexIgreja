import { rmSync } from "node:fs";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const outputPath = process.argv[2];
if (!outputPath) {
  throw new Error("Usage: node scripts/create-sqlite-migration-fixture.mjs /tmp/source.sqlite");
}

rmSync(outputPath, { force: true });
const db = new DatabaseSync(outputPath);
const tenantId = 1_760_000_000_123_456;
const unitId = 1_760_000_000_654_321;

try {
  db.exec(`
    CREATE TABLE tenants (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      access_code TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE organizational_units (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE unit_logos (
      unit_id INTEGER PRIMARY KEY,
      image_data BLOB NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.prepare(`
    INSERT INTO tenants (id, name, slug, access_code, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(tenantId, "Tenant BIGINT Test", "tenant-bigint-test", "7654321", "ATIVO", "2026-08-21T10:00:00.000Z", "2026-08-21T10:00:00.000Z");

  db.prepare(`
    INSERT INTO organizational_units (id, tenant_id, type, name, code, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(unitId, tenantId, "CONVENCAO", "Convenção BIGINT", "UNIT-BIGINT", "ATIVO", "2026-08-21T10:00:00.000Z", "2026-08-21T10:00:00.000Z");

  const image = Buffer.from([0, 1, 2, 3, 127, 128, 254, 255]);
  db.prepare(`
    INSERT INTO unit_logos (unit_id, image_data, mime_type, byte_size, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(unitId, image, "image/png", image.length, "2026-08-21T10:00:00.000Z");

  console.log(`SQLITE_MIGRATION_FIXTURE_OK tenantId=${tenantId} unitId=${unitId} blobBytes=${image.length}`);
} finally {
  db.close();
}

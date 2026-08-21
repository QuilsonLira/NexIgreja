import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const expectedTenantId = 1_760_000_000_123_456;
const expectedUnitId = 1_760_000_000_654_321;
const expectedBlob = Buffer.from([0, 1, 2, 3, 127, 128, 254, 255]);

const connection = await mysql.createConnection({
  uri: databaseUrl,
  supportBigNumbers: true,
  bigNumberStrings: false,
});

try {
  const [tenantRows] = await connection.query(
    "SELECT id FROM tenants WHERE id = ?",
    [expectedTenantId],
  );
  if (tenantRows.length !== 1 || Number(tenantRows[0].id) !== expectedTenantId) {
    throw new Error("BIGINT tenant ID was not preserved exactly");
  }

  const [unitRows] = await connection.query(
    "SELECT id, tenant_id AS tenantId FROM organizational_units WHERE id = ?",
    [expectedUnitId],
  );
  if (
    unitRows.length !== 1 ||
    Number(unitRows[0].id) !== expectedUnitId ||
    Number(unitRows[0].tenantId) !== expectedTenantId
  ) {
    throw new Error("BIGINT organizational unit relationship was not preserved exactly");
  }

  const [logoRows] = await connection.query(
    "SELECT unit_id AS unitId, image_data AS imageData, byte_size AS byteSize FROM unit_logos WHERE unit_id = ?",
    [expectedUnitId],
  );
  if (logoRows.length !== 1) throw new Error("Migrated BLOB row is missing");
  const imageData = Buffer.from(logoRows[0].imageData);
  if (Number(logoRows[0].unitId) !== expectedUnitId) throw new Error("BLOB foreign key ID changed");
  if (Number(logoRows[0].byteSize) !== expectedBlob.length) throw new Error("BLOB byte_size changed");
  if (!imageData.equals(expectedBlob)) throw new Error("BLOB bytes changed during SQLite -> MySQL import");

  console.log("MYSQL_IMPORT_FIXTURE_OK bigIntIds=preserved blob=preserved");
} finally {
  await connection.end();
}

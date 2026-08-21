import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import mysql from "mysql2/promise";

const args = new Set(process.argv.slice(2));
const sourceArg = process.argv.slice(2).find((value) => !value.startsWith("--"));
const sourcePath = path.resolve(sourceArg ?? process.env.SQLITE_SOURCE_PATH ?? "");
const verifyOnly = args.has("--verify-only");

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value || (!value.startsWith("mysql://") && !value.startsWith("mysql2://"))) {
    throw new Error("DATABASE_URL must point to the target MySQL database");
  }
  return value;
}

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function sourceColumns(sqlite, tableName) {
  return sqlite
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all()
    .map((row) => String(row.name));
}

async function targetColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT column_name AS columnName, extra
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
      ORDER BY ordinal_position`,
    [tableName],
  );
  return rows
    .filter((row) => !String(row.extra ?? "").toLowerCase().includes("generated"))
    .map((row) => String(row.columnName));
}

function normalizedValue(value) {
  if (value instanceof Uint8Array && !Buffer.isBuffer(value)) return Buffer.from(value);
  return value ?? null;
}

function assertSourceOwner(sqlite) {
  const ownerRows = sqlite.prepare(`
    SELECT owner.singleton_id, owner.user_id, owner.created_at, owner.updated_at,
           user.tenant_id, user.status, user.archived_at
      FROM platform_owners owner
      JOIN auth_users user ON user.id = owner.user_id
     ORDER BY owner.singleton_id
  `).all();

  if (ownerRows.length !== 1) {
    throw new Error(`Expected exactly one platform owner in SQLite source; found ${ownerRows.length}`);
  }
  const owner = ownerRows[0];
  if (Number(owner.singleton_id) !== 1) {
    throw new Error("SQLite platform owner must use singleton_id=1");
  }
  if (owner.tenant_id !== null) {
    throw new Error("Platform owner user must not belong to a tenant");
  }
  if (String(owner.status) !== "ATIVO" || owner.archived_at !== null) {
    throw new Error("Platform owner user is not active in SQLite source");
  }
  return { singletonId: Number(owner.singleton_id), userId: Number(owner.user_id) };
}

async function assertPreparedTarget(connection) {
  const required = ["auth_users", "platform_owners", "_nexigreja_migrations"];
  const [rows] = await connection.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()`,
  );
  const tables = new Set(rows.map((row) => String(row.tableName)));
  const missing = required.filter((name) => !tables.has(name));
  if (missing.length) {
    throw new Error(`Target MySQL is not prepared. Missing tables: ${missing.join(", ")}`);
  }
}

async function assertTargetClean(connection) {
  const [tenantRows] = await connection.query("SELECT COUNT(*) AS count FROM tenants");
  const [userRows] = await connection.query("SELECT COUNT(*) AS count FROM auth_users");
  const [ownerRows] = await connection.query("SELECT COUNT(*) AS count FROM platform_owners");
  const tenants = Number(tenantRows[0]?.count ?? 0);
  const users = Number(userRows[0]?.count ?? 0);
  const owners = Number(ownerRows[0]?.count ?? 0);
  if (tenants !== 0 || users !== 0 || owners !== 0) {
    throw new Error(
      `Target must be clean before owner seed (tenants=${tenants}, auth_users=${users}, platform_owners=${owners})`,
    );
  }
}

async function sharedColumns(sqlite, connection, tableName) {
  const source = new Set(sourceColumns(sqlite, tableName));
  const target = await targetColumns(connection, tableName);
  return target.filter((column) => source.has(column));
}

async function insertSourceRow(sqlite, connection, tableName, whereColumn, whereValue) {
  const columns = await sharedColumns(sqlite, connection, tableName);
  if (!columns.length) throw new Error(`${tableName}: no shared columns found`);

  const row = sqlite.prepare(
    `SELECT ${columns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(whereColumn)} = ? LIMIT 1`,
  ).get(whereValue);
  if (!row) throw new Error(`${tableName}: source row not found`);

  const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map(() => "?").join(",")})`;
  await connection.query(sql, columns.map((column) => normalizedValue(row[column])));
}

async function verifyOwner(sqlite, connection, owner) {
  const userColumns = await sharedColumns(sqlite, connection, "auth_users");
  const sourceUser = sqlite.prepare(
    `SELECT ${userColumns.map(quoteIdentifier).join(", ")} FROM auth_users WHERE id = ? LIMIT 1`,
  ).get(owner.userId);
  const [targetUsers] = await connection.query(
    `SELECT ${userColumns.map(quoteIdentifier).join(", ")} FROM auth_users WHERE id = ? LIMIT 1`,
    [owner.userId],
  );
  const targetUser = targetUsers[0];
  if (!sourceUser || !targetUser) throw new Error("Platform owner user verification failed: row missing");

  for (const column of userColumns) {
    const left = sourceUser[column];
    const right = targetUser[column];
    if (Buffer.isBuffer(left) || Buffer.isBuffer(right)) {
      if (!Buffer.from(left ?? []).equals(Buffer.from(right ?? []))) {
        throw new Error(`Platform owner user verification failed at auth_users.${column}`);
      }
      continue;
    }
    const normalizedLeft = left == null ? null : String(left);
    const normalizedRight = right == null ? null : String(right);
    if (normalizedLeft !== normalizedRight) {
      throw new Error(`Platform owner user verification failed at auth_users.${column}`);
    }
  }

  const [ownerRows] = await connection.query(
    "SELECT singleton_id AS singletonId, user_id AS userId FROM platform_owners WHERE singleton_id = 1 LIMIT 1",
  );
  if (Number(ownerRows[0]?.singletonId) !== 1 || Number(ownerRows[0]?.userId) !== owner.userId) {
    throw new Error("platform_owners verification failed");
  }

  const [tenantRows] = await connection.query("SELECT COUNT(*) AS count FROM tenants");
  if (Number(tenantRows[0]?.count ?? 0) !== 0) {
    throw new Error("Owner-only seed must not create tenants");
  }

  console.log(`MYSQL_PLATFORM_OWNER_VERIFY_OK userId=${owner.userId}`);
}

async function main() {
  if (!sourceArg && !process.env.SQLITE_SOURCE_PATH) {
    throw new Error("Usage: node scripts/seed-platform-owner-from-sqlite.mjs /path/to/d1.sqlite [--verify-only]");
  }
  await access(sourcePath);

  const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
  const connection = await mysql.createConnection({
    uri: requireDatabaseUrl(),
    supportBigNumbers: true,
    bigNumberStrings: false,
  });

  try {
    const owner = assertSourceOwner(sqlite);
    await assertPreparedTarget(connection);

    if (verifyOnly) {
      await verifyOwner(sqlite, connection, owner);
      return;
    }

    await assertTargetClean(connection);
    await connection.beginTransaction();
    try {
      await insertSourceRow(sqlite, connection, "auth_users", "id", owner.userId);
      await insertSourceRow(sqlite, connection, "platform_owners", "singleton_id", owner.singletonId);
      await verifyOwner(sqlite, connection, owner);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    console.log(`MYSQL_PLATFORM_OWNER_SEED_OK userId=${owner.userId}`);
  } finally {
    sqlite.close();
    await connection.end();
  }
}

await main();

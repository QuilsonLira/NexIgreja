import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import mysql from "mysql2/promise";

const args = new Set(process.argv.slice(2));
const sourceArg = process.argv.slice(2).find((value) => !value.startsWith("--"));
const sourcePath = path.resolve(sourceArg ?? process.env.SQLITE_SOURCE_PATH ?? "");
const preflightOnly = args.has("--preflight");
const allowNonEmpty = args.has("--allow-nonempty-target");
const batchSize = Math.max(1, Math.min(1000, Number(process.env.MIGRATION_BATCH_SIZE ?? 200)));

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

function normalizeSqliteValue(value) {
  if (value === undefined) return null;
  if (value instanceof Uint8Array && !Buffer.isBuffer(value)) return Buffer.from(value);
  return value;
}

function chunks(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sourceTables(sqlite) {
  return sqlite
    .prepare(`
      SELECT name
        FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name
    `)
    .all()
    .map((row) => String(row.name));
}

function sourceColumns(sqlite, tableName) {
  return sqlite
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all()
    .map((row) => ({
      name: String(row.name),
      type: String(row.type ?? "").toUpperCase(),
    }));
}

async function targetColumns(connection, tableName) {
  const [rows] = await connection.query(
    `SELECT column_name AS columnName,
            data_type AS dataType,
            column_type AS columnType,
            character_maximum_length AS maxLength,
            is_nullable AS isNullable,
            column_default AS columnDefault,
            extra AS extra
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
      ORDER BY ordinal_position`,
    [tableName],
  );
  return rows.map((row) => {
    const extra = String(row.extra ?? "").toLowerCase();
    return {
      name: String(row.columnName),
      dataType: String(row.dataType ?? "").toLowerCase(),
      columnType: String(row.columnType ?? "").toLowerCase(),
      maxLength: row.maxLength == null ? null : Number(row.maxLength),
      nullable: String(row.isNullable) === "YES",
      defaultValue: row.columnDefault,
      generated: extra.includes("generated"),
      autoIncrement: extra.includes("auto_increment"),
    };
  });
}

async function targetTableSet(connection) {
  const [rows] = await connection.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name`,
  );
  return new Set(rows.map((row) => String(row.tableName)));
}

async function assertSchemaPrepared(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = '_nexigreja_migrations'`,
  );
  if (Number(rows[0]?.count ?? 0) !== 1) {
    throw new Error("Target MySQL schema is not prepared. Run npm run db:mysql:migrate first.");
  }
  const [migrationRows] = await connection.query(
    "SELECT COUNT(*) AS count FROM `_nexigreja_migrations`",
  );
  if (Number(migrationRows[0]?.count ?? 0) < 2) {
    throw new Error("Target MySQL migrations are incomplete.");
  }
}

async function assertTargetEmpty(connection, tables) {
  if (allowNonEmpty) return;
  const populated = [];
  for (const tableName of tables) {
    if (tableName === "_nexigreja_migrations") continue;
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) populated.push(`${tableName}=${count}`);
  }
  if (populated.length) {
    throw new Error(
      `Target MySQL already contains application data. Refusing import: ${populated.slice(0, 12).join(", ")}${populated.length > 12 ? ", ..." : ""}`,
    );
  }
}

function maxSourceTextLength(sqlite, tableName, columnName) {
  const sql = `SELECT MAX(LENGTH(CAST(${quoteIdentifier(columnName)} AS TEXT))) AS maxLength FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(columnName)} IS NOT NULL`;
  const row = sqlite.prepare(sql).get();
  return row?.maxLength == null ? 0 : Number(row.maxLength);
}

async function buildPlan(sqlite, connection) {
  const mysqlTables = await targetTableSet(connection);
  const plan = [];
  const warnings = [];

  for (const tableName of sourceTables(sqlite)) {
    if (!mysqlTables.has(tableName)) {
      warnings.push(`Source-only table skipped: ${tableName}`);
      continue;
    }

    const srcColumns = sourceColumns(sqlite, tableName);
    const srcNames = new Set(srcColumns.map((column) => column.name));
    const dstColumns = await targetColumns(connection, tableName);
    const insertColumns = dstColumns.filter((column) => !column.generated && srcNames.has(column.name));

    const missingRequired = dstColumns.filter(
      (column) =>
        !column.generated &&
        !column.autoIncrement &&
        !srcNames.has(column.name) &&
        !column.nullable &&
        column.defaultValue == null,
    );
    if (missingRequired.length) {
      throw new Error(
        `${tableName}: target has required columns absent from SQLite source: ${missingRequired.map((column) => column.name).join(", ")}`,
      );
    }

    for (const column of insertColumns) {
      if (column.maxLength == null) continue;
      const maxSource = maxSourceTextLength(sqlite, tableName, column.name);
      if (maxSource > column.maxLength) {
        throw new Error(
          `${tableName}.${column.name}: source length ${maxSource} exceeds target VARCHAR(${column.maxLength})`,
        );
      }
    }

    const countRow = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`).get();
    const sourceCount = Number(countRow?.count ?? 0);
    plan.push({ tableName, columns: insertColumns.map((column) => column.name), sourceCount });
  }

  return { plan, warnings };
}

async function insertTable(sqlite, connection, item) {
  if (item.sourceCount === 0) return 0;
  if (item.columns.length === 0) {
    throw new Error(`${item.tableName}: no compatible columns available for import`);
  }

  const selectSql = `SELECT ${item.columns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(item.tableName)}`;
  const rows = sqlite.prepare(selectSql).all();
  let inserted = 0;

  for (const group of chunks(rows, batchSize)) {
    const placeholders = group
      .map(() => `(${item.columns.map(() => "?").join(",")})`)
      .join(",");
    const values = group.flatMap((row) => item.columns.map((column) => normalizeSqliteValue(row[column])));
    const sql = `INSERT INTO ${quoteIdentifier(item.tableName)} (${item.columns.map(quoteIdentifier).join(",")}) VALUES ${placeholders}`;
    await connection.query(sql, values);
    inserted += group.length;
  }
  return inserted;
}

async function verifyCounts(sqlite, connection, plan) {
  const failures = [];
  for (const item of plan) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS count FROM ${quoteIdentifier(item.tableName)}`,
    );
    const targetCount = Number(rows[0]?.count ?? 0);
    if (targetCount !== item.sourceCount) {
      failures.push(`${item.tableName}: source=${item.sourceCount}, target=${targetCount}`);
    }
  }
  if (failures.length) {
    throw new Error(`Row-count verification failed: ${failures.slice(0, 20).join("; ")}`);
  }
}

async function verifyForeignKeys(connection) {
  const [keys] = await connection.query(`
    SELECT constraint_name AS constraintName,
           table_name AS tableName,
           column_name AS columnName,
           referenced_table_name AS refTable,
           referenced_column_name AS refColumn,
           ordinal_position AS ordinalPosition
      FROM information_schema.key_column_usage
     WHERE table_schema = DATABASE()
       AND referenced_table_name IS NOT NULL
     ORDER BY table_name, constraint_name, ordinal_position
  `);

  const grouped = new Map();
  for (const key of keys) {
    const groupKey = `${key.tableName}:${key.constraintName}`;
    const group = grouped.get(groupKey) ?? {
      constraintName: String(key.constraintName),
      tableName: String(key.tableName),
      refTable: String(key.refTable),
      columns: [],
    };
    group.columns.push({
      columnName: String(key.columnName),
      refColumn: String(key.refColumn),
      ordinalPosition: Number(key.ordinalPosition),
    });
    grouped.set(groupKey, group);
  }

  const failures = [];
  for (const group of grouped.values()) {
    group.columns.sort((a, b) => a.ordinalPosition - b.ordinalPosition);
    const join = group.columns
      .map(
        ({ columnName, refColumn }) =>
          `child.${quoteIdentifier(columnName)} = parent.${quoteIdentifier(refColumn)}`,
      )
      .join(" AND ");
    const nonNull = group.columns
      .map(({ columnName }) => `child.${quoteIdentifier(columnName)} IS NOT NULL`)
      .join(" AND ");
    const firstParentColumn = group.columns[0]?.refColumn;
    if (!firstParentColumn) continue;

    const [rows] = await connection.query(`
      SELECT COUNT(*) AS count
        FROM ${quoteIdentifier(group.tableName)} child
        LEFT JOIN ${quoteIdentifier(group.refTable)} parent
          ON ${join}
       WHERE ${nonNull}
         AND parent.${quoteIdentifier(firstParentColumn)} IS NULL
    `);
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      failures.push(
        `${group.tableName}.${group.constraintName} -> ${group.refTable}: ${count} orphan(s)`,
      );
    }
  }
  if (failures.length) {
    throw new Error(`Foreign-key verification failed: ${failures.slice(0, 20).join("; ")}`);
  }
}

async function main() {
  if (!sourceArg && !process.env.SQLITE_SOURCE_PATH) {
    throw new Error("Usage: node scripts/migrate-sqlite-data-to-mysql.mjs /path/to/d1.sqlite [--preflight]");
  }
  await access(sourcePath);

  const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
  const connection = await mysql.createConnection({
    uri: requireDatabaseUrl(),
    supportBigNumbers: true,
    bigNumberStrings: false,
  });

  try {
    await assertSchemaPrepared(connection);
    const { plan, warnings } = await buildPlan(sqlite, connection);
    await assertTargetEmpty(connection, plan.map((item) => item.tableName));

    const totalRows = plan.reduce((sum, item) => sum + item.sourceCount, 0);
    console.log(`MIGRATION_PREFLIGHT_OK tables=${plan.length} rows=${totalRows}`);
    for (const warning of warnings) console.warn(`WARN ${warning}`);

    if (preflightOnly) return;

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.beginTransaction();
    try {
      for (const item of plan) {
        const inserted = await insertTable(sqlite, connection, item);
        console.log(`COPIED ${item.tableName} rows=${inserted}`);
      }
      await verifyCounts(sqlite, connection, plan);
      await verifyForeignKeys(connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log(`SQLITE_TO_MYSQL_MIGRATION_OK tables=${plan.length} rows=${totalRows}`);
  } finally {
    sqlite.close();
    await connection.end();
  }
}

await main();

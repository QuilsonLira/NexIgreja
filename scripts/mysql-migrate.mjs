import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";

const root = process.cwd();
const migrationTable = "_nexigreja_migrations";

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value || (!value.startsWith("mysql://") && !value.startsWith("mysql2://"))) {
    throw new Error("DATABASE_URL must be configured with a MySQL connection string");
  }
  return value;
}

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

function splitSql(content, drizzleStyle) {
  if (drizzleStyle) {
    return content
      .split(/-->\s*statement-breakpoint\s*/g)
      .map((statement) => statement.trim())
      .filter(Boolean);
  }

  const statements = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1] ?? "";

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        current += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && char === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (!quote && char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote && quote !== "`") {
          current += next;
          index += 1;
        } else if (content[index - 1] !== "\\") {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function migrationFiles() {
  const drizzleDir = path.join(root, "drizzle-mysql");
  const drizzleFiles = (await readdir(drizzleDir))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name: `drizzle-mysql/${name}`,
      filePath: path.join(drizzleDir, name),
      drizzleStyle: true,
      baseline: true,
    }));

  const partialPath = path.join(root, "database", "mysql", "003_partial_unique_constraints.sql");
  drizzleFiles.push({
    name: "database/mysql/003_partial_unique_constraints.sql",
    filePath: partialPath,
    drizzleStyle: false,
    baseline: false,
  });
  return drizzleFiles;
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`${migrationTable}\` (
      name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function existingApplicationTables(connection) {
  const [rows] = await connection.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name <> ?
      ORDER BY table_name`,
    [migrationTable],
  );
  return rows.map((row) => String(row.tableName));
}

async function appliedMigrations(connection) {
  const [rows] = await connection.query(
    `SELECT name, checksum, applied_at AS appliedAt FROM \`${migrationTable}\` ORDER BY applied_at, name`,
  );
  return new Map(rows.map((row) => [String(row.name), row]));
}

async function main() {
  const connection = await mysql.createConnection(databaseUrl());
  try {
    await ensureMigrationTable(connection);
    const files = await migrationFiles();
    const applied = await appliedMigrations(connection);

    if (process.argv.includes("--status")) {
      console.log(`MySQL migration status: ${applied.size} applied migration(s).`);
      for (const file of files) {
        const state = applied.has(file.name) ? "APPLIED" : "PENDING";
        console.log(`${state} ${file.name}`);
      }
      return;
    }

    if (applied.size === 0) {
      const existing = await existingApplicationTables(connection);
      if (existing.length > 0) {
        throw new Error(
          `Refusing baseline migration because the database is not empty. Existing tables: ${existing.slice(0, 12).join(", ")}${existing.length > 12 ? ", ..." : ""}`,
        );
      }
    }

    for (const file of files) {
      const content = await readFile(file.filePath, "utf8");
      const hash = checksum(content);
      const previous = applied.get(file.name);
      if (previous) {
        if (String(previous.checksum) !== hash) {
          throw new Error(`Migration checksum changed after application: ${file.name}`);
        }
        console.log(`SKIP ${file.name}`);
        continue;
      }

      const statements = splitSql(content, file.drizzleStyle);
      console.log(`APPLY ${file.name} (${statements.length} statements)`);
      for (let index = 0; index < statements.length; index += 1) {
        try {
          await connection.query(statements[index]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${file.name} statement ${index + 1}/${statements.length} failed: ${message}`);
        }
      }
      await connection.query(
        `INSERT INTO \`${migrationTable}\` (name, checksum) VALUES (?, ?)`,
        [file.name, hash],
      );
      applied.set(file.name, { name: file.name, checksum: hash });
      console.log(`DONE ${file.name}`);
    }

    console.log("MYSQL_MIGRATIONS_OK");
  } finally {
    await connection.end();
  }
}

await main();

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ddlDir = path.resolve(process.cwd(), "drizzle-mysql");
const files = (await readdir(ddlDir)).filter((name) => name.endsWith(".sql")).sort();
if (files.length === 0) throw new Error("No generated MySQL migration SQL found");

const sql = (await Promise.all(files.map((name) => readFile(path.join(ddlDir, name), "utf8")))).join("\n");
const tables = new Map();

for (const match of sql.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\);/g)) {
  const [, tableName, body] = match;
  const columns = new Map();
  for (const line of body.split("\n")) {
    const column = line.match(/^\s*`([^`]+)`\s+([^,]+?)(?:,)?$/);
    if (column) columns.set(column[1], column[2].toUpperCase());
  }
  tables.set(tableName, { body, columns });
}

if (tables.size < 85) {
  throw new Error(`Expected at least 85 MySQL tables, generated ${tables.size}`);
}

const riskyType = (type) => /\b(TEXT|BLOB|MEDIUMBLOB|LONGBLOB|JSON)\b/.test(type ?? "");
const failures = [];

function inspectKey(tableName, keyName, expression) {
  const table = tables.get(tableName);
  if (!table) return;
  const columns = [...expression.matchAll(/`([^`]+)`/g)].map((entry) => entry[1]);
  for (const columnName of columns) {
    const type = table.columns.get(columnName) ?? "";
    if (riskyType(type)) failures.push(`${tableName}.${keyName} indexes ${columnName} as ${type}`);
  }
}

for (const [tableName, table] of tables) {
  for (const match of table.body.matchAll(/CONSTRAINT `([^`]+)` UNIQUE\(([^\)]+)\)/g)) {
    inspectKey(tableName, match[1], match[2]);
  }
  for (const match of table.body.matchAll(/PRIMARY KEY\(([^\)]+)\)/g)) {
    inspectKey(tableName, "PRIMARY KEY", match[1]);
  }
}

for (const match of sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+`([^`]+)`\s+ON\s+`([^`]+)`\s*\(([^;]+)\);/gi)) {
  inspectKey(match[2], match[1], match[3]);
}

for (const forbidden of [
  "auth_users_platform_username_unique",
  "auth_users_platform_email_unique",
  "auth_users_platform_cpf_unique",
  "organizational_units_tenant_own_cnpj_unique",
]) {
  if (sql.includes(forbidden)) {
    failures.push(`${forbidden} must not be emitted by base Drizzle DDL; it belongs to 003_partial_unique_constraints.sql`);
  }
}

for (const required of [
  "auth_users_tenant_username_unique",
  "auth_users_tenant_email_unique",
  "auth_users_tenant_cpf_unique",
  "people_tenant_cpf_unique",
]) {
  if (!sql.includes(required)) failures.push(`Required tenant-scoped uniqueness ${required} is missing`);
}

if (failures.length) {
  console.error("MySQL DDL audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`MySQL DDL audit passed for ${tables.size} tables across ${files.length} migration file(s).`);

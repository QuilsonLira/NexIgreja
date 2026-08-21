import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const inputPath = path.join(root, "db", "schema.ts");
const outputPath = path.join(root, "db", "schema.mysql.ts");

let source = await readFile(inputPath, "utf8");

const sqliteImport = /import\s*\{[\s\S]*?\}\s*from\s*["']drizzle-orm\/sqlite-core["'];/;
if (!sqliteImport.test(source)) {
  throw new Error("Could not find drizzle-orm/sqlite-core import in db/schema.ts");
}

source = source.replace(
  sqliteImport,
  `import {
  boolean,
  check,
  customType,
  foreignKey,
  index,
  int,
  json,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";

const longBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "LONGBLOB";
  },
});`,
);

// SQLite stores booleans as INTEGER with a mode flag. Accept both compact and
// multi-line object syntax, including a trailing comma.
source = source.replace(
  /integer\(\s*([^,\n]+?)\s*,\s*\{\s*mode:\s*["']boolean["']\s*,?\s*\}\s*\)/g,
  "boolean($1)",
);

// JSON can be represented by SQLite TEXT/BLOB mode; MySQL exposes json().
source = source.replace(
  /text\(\s*([^,\n]+?)\s*,\s*\{\s*mode:\s*["']json["']\s*,?\s*\}\s*\)/g,
  "json($1)",
);
source = source.replace(
  /blob\(\s*([^,\n]+?)\s*,\s*\{\s*mode:\s*["']json["']\s*,?\s*\}\s*\)/g,
  "json($1)",
);

// Image/logo/photo payloads use SQLite blob buffer mode. LONGBLOB avoids the
// 64 KiB limit of BLOB and keeps the existing Buffer contract.
source = source.replace(
  /blob\(\s*([^,\n]+?)\s*,\s*\{\s*mode:\s*["']buffer["']\s*,?\s*\}\s*\)/g,
  "longBlob($1)",
);

// A few SQLite partial unique indexes cannot be represented by a normal MySQL
// unique index without changing business semantics. They are recreated with
// generated columns in database/mysql/003_partial_unique_constraints.sql.
for (const indexName of [
  "organizational_units_tenant_own_cnpj_unique",
  "auth_users_platform_username_unique",
  "auth_users_platform_email_unique",
  "auth_users_platform_cpf_unique",
]) {
  const escaped = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const partialIndex = new RegExp(
    `\\s*uniqueIndex\\(\\"${escaped}\\"\\)[\\s\\S]*?\\.where\\(\\s*sql\\\`[\\s\\S]*?\\\`\\s*\\),?`,
    "g",
  );
  source = source.replace(partialIndex, "");
}

source = source
  .replace(/\bsqliteTable\b/g, "mysqlTable")
  .replace(/\bAnySQLiteColumn\b/g, "AnyMySqlColumn")
  .replace(/\binteger\s*\(/g, "int(");

// MySQL cannot index an unbounded TEXT column. Keep genuinely long fields as
// TEXT and map normal domain strings to bounded VARCHAR columns. The default
// 191 chars is intentionally index-safe under utf8mb4, while fields with
// established wider formats receive explicit lengths.
const longTextColumns = new Set([
  "body",
  "body_snapshot",
  "content",
  "description",
  "details",
  "notes",
  "message",
  "summary",
  "instructions",
  "help_text",
  "department_resolution",
  "ebd_resolution",
  "theological_education",
  "metadata_json",
  "options_json",
  "payload_json",
  "permissions_json",
  "participating_category_ids_json",
  "signature_labels_json",
  "signatures_snapshot",
  "style_json",
  "enabled_features",
  "modules",
  "target_profiles",
  "previous_values",
  "new_values",
  "header_snapshot",
  "footer_snapshot",
  "header_text",
  "footer_text",
  "user_agent",
]);

function varcharLength(columnName) {
  if (/email$/.test(columnName)) return 254;
  if (columnName === "username") return 100;
  if (columnName === "password_hash" || columnName === "password_salt") return 255;
  if (/token_hash$/.test(columnName) || /fingerprint$/.test(columnName) || columnName === "source_hash") return 191;
  if (columnName === "cpf" || columnName === "cnpj") return 32;
  if (/phone$/.test(columnName) || columnName === "whatsapp") return 40;
  if (columnName === "postal_code") return 20;
  if (columnName === "voter_title") return 32;
  if (/(_at|_date|_on|_until|_since|_time)$/.test(columnName)) return 40;
  if (columnName === "competency" || columnName === "competence") return 16;
  if (columnName === "status" || /_status$/.test(columnName)) return 80;
  if (columnName === "type" || /_type$/.test(columnName) || columnName === "kind" || columnName === "scope") return 80;
  if (columnName === "name" || /_name$/.test(columnName) || columnName === "title" || columnName === "full_name") return 255;
  if (columnName === "slug" || columnName === "group_key" || columnName === "external_reference") return 191;
  return 191;
}

source = source.replace(/\btext\(\s*(["'])([^"']+)\1\s*\)/g, (match, quote, columnName) => {
  if (longTextColumns.has(columnName)) return match;
  return `varchar(${quote}${columnName}${quote}, { length: ${varcharLength(columnName)} })`;
});

// SQLite's autoIncrement option is expressed differently by mysql-core.
source = source.replace(
  /\.primaryKey\(\s*\{\s*autoIncrement:\s*true\s*\}\s*\)/g,
  ".autoincrement().primaryKey()",
);

// Remaining partial indexes are safe to express as ordinary MySQL unique
// indexes because nullable key parts retain the intended behavior (for example
// tenant_id + cpf, where multiple NULL cpf values are allowed).
source = source.replace(/\s*\.where\(\s*sql`[\s\S]*?`\s*\)/g, "");

// Fail loudly if any SQLite-only mode flag or blob builder remains.
if (/\bblob\s*\(/.test(source)) {
  throw new Error("Unconverted SQLite blob() call remains in generated schema");
}
if (/\bint\([^)]*\{\s*mode\s*:/.test(source)) {
  throw new Error("Unconverted SQLite integer mode remains in generated schema");
}
for (const forbiddenIndex of [
  "organizational_units_tenant_own_cnpj_unique",
  "auth_users_platform_username_unique",
  "auth_users_platform_email_unique",
  "auth_users_platform_cpf_unique",
]) {
  if (source.includes(forbiddenIndex)) {
    throw new Error(`Partial index ${forbiddenIndex} must be implemented by MySQL compatibility DDL`);
  }
}

const banner = `// AUTO-GENERATED by scripts/generate-mysql-schema.mjs.
// Do not edit this file directly. Update db/schema.ts and regenerate instead.
// Conditional unique constraints that MySQL cannot model as partial indexes
// are applied by database/mysql/003_partial_unique_constraints.sql.

`;

await writeFile(outputPath, banner + source, "utf8");
console.log(`Generated ${path.relative(root, outputPath)} from db/schema.ts`);

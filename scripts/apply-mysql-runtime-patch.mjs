import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const authPath = path.join(process.cwd(), "lib", "server", "auth.ts");
let source = await readFile(authPath, "utf8");

const importLine = 'import { getMysqlD1CompatDatabase, isMysqlBackendConfigured } from "./mysql-d1-compat";';
if (!source.includes(importLine)) {
  const anchor = 'import bcrypt from "bcryptjs";';
  if (!source.includes(anchor)) {
    throw new Error("auth.ts bcrypt import anchor not found");
  }
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const oldDatabase = `export function database(): D1Database {\n  const db = (globalThis as typeof globalThis & { __NEXIGREJA_DB?: D1Database })\n    .__NEXIGREJA_DB;\n  if (!db) {\n    throw new ApiError(\n      503,\n      "BANCO_INDISPONIVEL",\n      "Banco de dados indisponível. Tente novamente em instantes.",\n    );\n  }\n  return db;\n}`;

const newDatabase = `export function database(): D1Database {\n  if (isMysqlBackendConfigured()) {\n    return getMysqlD1CompatDatabase();\n  }\n\n  const db = (globalThis as typeof globalThis & { __NEXIGREJA_DB?: D1Database })\n    .__NEXIGREJA_DB;\n  if (!db) {\n    throw new ApiError(\n      503,\n      "BANCO_INDISPONIVEL",\n      "Banco de dados indisponível. Tente novamente em instantes.",\n    );\n  }\n  return db;\n}`;

if (!source.includes(newDatabase)) {
  if (!source.includes(oldDatabase)) {
    throw new Error("auth.ts database() anchor not found");
  }
  source = source.replace(oldDatabase, newDatabase);
}

const initAnchor = `async function initializeDatabase(): Promise<void> {\n  const db = database();`;
const mysqlInit = `async function initializeDatabase(): Promise<void> {\n  const db = database();\n\n  if (isMysqlBackendConfigured()) {\n    try {\n      await db.prepare("SELECT 1 AS ok FROM tenants LIMIT 1").first();\n    } catch {\n      throw new ApiError(\n        503,\n        "BANCO_MYSQL_NAO_PREPARADO",\n        "O banco MySQL ainda não recebeu a estrutura do NexIgreja.",\n      );\n    }\n    return;\n  }`;

if (!source.includes(mysqlInit)) {
  if (!source.includes(initAnchor)) {
    throw new Error("auth.ts initializeDatabase() anchor not found");
  }
  source = source.replace(initAnchor, mysqlInit);
}

await writeFile(authPath, source, "utf8");
console.log("MySQL runtime patch applied to lib/server/auth.ts");

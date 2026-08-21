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

const legacyMysqlInit = `async function initializeDatabase(): Promise<void> {\n  const db = database();\n\n  if (isMysqlBackendConfigured()) {\n    try {\n      await db.prepare("SELECT 1 AS ok FROM tenants LIMIT 1").first();\n    } catch {\n      throw new ApiError(\n        503,\n        "BANCO_MYSQL_NAO_PREPARADO",\n        "O banco MySQL ainda não recebeu a estrutura do NexIgreja.",\n      );\n    }\n    return;\n  }`;

const diagnosticMysqlInit = `async function initializeDatabase(): Promise<void> {\n  const db = database();\n\n  if (isMysqlBackendConfigured()) {\n    try {\n      const selectedDatabase = await db\n        .prepare("SELECT DATABASE() AS database_name")\n        .first<{ database_name: string | null }>();\n      const schemaCheck = await db\n        .prepare(\n          "SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'tenants'",\n        )\n        .first<{ total: number | string }>();\n\n      const databaseName = selectedDatabase?.database_name ?? null;\n      const tenantsTableCount = Number(schemaCheck?.total ?? 0);\n\n      if (!databaseName) {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_SEM_DATABASE",\n          "A conexão MySQL foi aberta, mas nenhum banco foi selecionado. Verifique DB_NAME.",\n        );\n      }\n\n      if (tenantsTableCount < 1) {\n        console.error("[NexIgreja][MySQL] estrutura ausente", { database: databaseName });\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_ESTRUTURA_AUSENTE",\n          "A conexão MySQL funcionou, mas a tabela tenants não existe no banco configurado. Verifique DB_NAME.",\n        );\n      }\n    } catch (error) {\n      if (error instanceof ApiError) throw error;\n\n      const details = error as {\n        code?: unknown;\n        errno?: unknown;\n        sqlState?: unknown;\n        message?: unknown;\n      };\n      const mysqlCode =\n        typeof details.code === "string" ? details.code : "MYSQL_UNKNOWN";\n\n      console.error("[NexIgreja][MySQL] falha na inicialização", {\n        code: mysqlCode,\n        errno: details.errno ?? null,\n        sqlState: details.sqlState ?? null,\n        message: String(details.message ?? ""),\n      });\n\n      if (mysqlCode === "ER_ACCESS_DENIED_ERROR") {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_ACESSO_NEGADO",\n          "O MySQL recusou o usuário ou a senha. Confira DB_USER e DB_PASSWORD.",\n        );\n      }\n      if (mysqlCode === "ER_BAD_DB_ERROR") {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_DATABASE_INEXISTENTE",\n          "O banco informado em DB_NAME não existe ou não está acessível para esse usuário.",\n        );\n      }\n      if (mysqlCode === "ER_DBACCESS_DENIED_ERROR") {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_DATABASE_SEM_PERMISSAO",\n          "O usuário MySQL não tem permissão para acessar o banco configurado.",\n        );\n      }\n      if (mysqlCode === "ECONNREFUSED") {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_CONEXAO_RECUSADA",\n          "A conexão com o servidor MySQL foi recusada. Confira DB_HOST e DB_PORT.",\n        );\n      }\n      if (mysqlCode === "ENOTFOUND" || mysqlCode === "EAI_AGAIN") {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_HOST_INVALIDO",\n          "O servidor MySQL informado em DB_HOST não foi encontrado.",\n        );\n      }\n      if (mysqlCode === "ETIMEDOUT" || mysqlCode === "PROTOCOL_SEQUENCE_TIMEOUT") {\n        throw new ApiError(\n          503,\n          "BANCO_MYSQL_TIMEOUT",\n          "A conexão com o MySQL expirou antes de responder.",\n        );\n      }\n\n      throw new ApiError(\n        503,\n        "BANCO_MYSQL_FALHA_CONEXAO",\n        \`Falha na conexão com o MySQL (\${mysqlCode}). Consulte os logs de execução da Hostinger.\`,\n      );\n    }\n    return;\n  }`;

if (!source.includes(diagnosticMysqlInit)) {
  if (source.includes(legacyMysqlInit)) {
    source = source.replace(legacyMysqlInit, diagnosticMysqlInit);
  } else if (source.includes(initAnchor)) {
    source = source.replace(initAnchor, diagnosticMysqlInit);
  } else {
    throw new Error("auth.ts initializeDatabase() anchor not found");
  }
}

await writeFile(authPath, source, "utf8");
console.log("MySQL runtime patch applied to lib/server/auth.ts");

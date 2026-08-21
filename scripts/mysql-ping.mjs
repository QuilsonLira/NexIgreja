import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("DATABASE_URL não está configurada.");
  process.exit(2);
}

if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysql2://")) {
  console.error("DATABASE_URL precisa usar o protocolo mysql://.");
  process.exit(2);
}

let connection;

try {
  connection = await mysql.createConnection(databaseUrl);
  const [rows] = await connection.query(
    "SELECT 1 AS ok, DATABASE() AS databaseName, VERSION() AS mysqlVersion",
  );
  const result = Array.isArray(rows) ? rows[0] : null;

  const [tableRows] = await connection.query(
    "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name",
  );
  const tableNames = new Set(
    Array.isArray(tableRows) ? tableRows.map((row) => String(row.tableName)) : [],
  );
  const required = [
    "tenants",
    "organizational_units",
    "auth_users",
    "people",
    "finance_periods",
    "finance_accounts",
    "finance_movements",
    "finance_categories",
    "finance_obligations",
    "commercial_features",
    "plan_features",
    "tenant_feature_overrides",
    "secretary_audit",
    "secretary_document_sequences",
    "platform_owners",
    "_nexigreja_migrations",
  ];
  const missing = required.filter((name) => !tableNames.has(name));
  if (missing.length > 0) {
    throw new Error(`Estrutura MySQL incompleta. Tabelas ausentes: ${missing.join(", ")}`);
  }

  const expectedMinimumTables = 117;
  if (tableNames.size < expectedMinimumTables) {
    throw new Error(
      `Estrutura MySQL incompleta. Esperadas ao menos ${expectedMinimumTables} tabelas, encontradas ${tableNames.size}.`,
    );
  }

  console.log("MYSQL_CONNECTION_OK");
  console.log(`database=${result?.databaseName ?? "unknown"}`);
  console.log(`version=${result?.mysqlVersion ?? "unknown"}`);
  console.log(`tables=${tableNames.size}`);
  console.log("MYSQL_SCHEMA_COMPLETE_OK");
} catch (error) {
  console.error("MYSQL_CONNECTION_FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await connection?.end();
}

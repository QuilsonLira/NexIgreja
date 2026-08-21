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

  console.log("MYSQL_CONNECTION_OK");
  console.log(`database=${result?.databaseName ?? "unknown"}`);
  console.log(`version=${result?.mysqlVersion ?? "unknown"}`);
} catch (error) {
  console.error("MYSQL_CONNECTION_FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await connection?.end();
}

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.mysql";

const globalForMysql = globalThis as typeof globalThis & {
  __NEXIGREJA_MYSQL_POOL?: mysql.Pool;
};

function requireDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for the MySQL backend. Configure it only as a server-side environment variable.",
    );
  }

  if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysql2://")) {
    throw new Error("DATABASE_URL must use the mysql:// protocol.");
  }

  return databaseUrl;
}

export function getMysqlPool() {
  if (!globalForMysql.__NEXIGREJA_MYSQL_POOL) {
    globalForMysql.__NEXIGREJA_MYSQL_POOL = mysql.createPool({
      uri: requireDatabaseUrl(),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
      maxIdle: Number(process.env.DB_POOL_MAX_IDLE ?? 10),
      idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 60_000),
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }

  return globalForMysql.__NEXIGREJA_MYSQL_POOL;
}

export function getMysqlDb() {
  return drizzle(getMysqlPool(), { schema, mode: "default" });
}

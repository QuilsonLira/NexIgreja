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

function mysqlPoolConfig(): mysql.PoolOptions {
  const parsed = new URL(requireDatabaseUrl());
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!parsed.hostname || !parsed.username || !database) {
    throw new Error(
      "DATABASE_URL must include host, user and database name.",
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    maxIdle: Number(process.env.DB_POOL_MAX_IDLE ?? 10),
    idleTimeout: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 60_000),
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10_000),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    supportBigNumbers: true,
    bigNumberStrings: false,
  };
}

export function getMysqlPool() {
  if (!globalForMysql.__NEXIGREJA_MYSQL_POOL) {
    globalForMysql.__NEXIGREJA_MYSQL_POOL = mysql.createPool(mysqlPoolConfig());
  }

  return globalForMysql.__NEXIGREJA_MYSQL_POOL;
}

export function getMysqlDb() {
  return drizzle(getMysqlPool(), { schema, mode: "default" });
}

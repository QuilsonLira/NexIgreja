import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.mysql";

const globalForMysql = globalThis as typeof globalThis & {
  __NEXIGREJA_MYSQL_POOL?: mysql.Pool;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function connectionFromSeparateEnvironment(): mysql.PoolOptions | null {
  const host = process.env.DB_HOST?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME?.trim();

  const anyProvided = Boolean(host || user || password !== undefined || database);
  if (!anyProvided) return null;

  if (!host || !user || password === undefined || !database) {
    throw new Error(
      "DB_HOST, DB_USER, DB_PASSWORD e DB_NAME precisam estar todos configurados quando variáveis MySQL separadas forem usadas.",
    );
  }

  return {
    host,
    port: positiveInteger(process.env.DB_PORT, 3306),
    user,
    password,
    database,
  };
}

function connectionFromDatabaseUrl(): mysql.PoolOptions {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "Configure DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ou DATABASE_URL para o backend MySQL.",
    );
  }

  if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysql2://")) {
    throw new Error("DATABASE_URL must use the mysql:// protocol.");
  }

  const normalizedUrl = databaseUrl.startsWith("mysql2://")
    ? "mysql://" + databaseUrl.slice(9)
    : databaseUrl;
  const parsed = new URL(normalizedUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!parsed.hostname || !parsed.username || !database) {
    throw new Error("DATABASE_URL must include host, user and database name.");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? positiveInteger(parsed.port, 3306) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

function mysqlPoolConfig(): mysql.PoolOptions {
  const connection = connectionFromSeparateEnvironment() ?? connectionFromDatabaseUrl();

  return {
    ...connection,
    waitForConnections: true,
    connectionLimit: positiveInteger(process.env.DB_POOL_SIZE, 10),
    maxIdle: positiveInteger(process.env.DB_POOL_MAX_IDLE, 10),
    idleTimeout: positiveInteger(process.env.DB_POOL_IDLE_TIMEOUT_MS, 60_000),
    connectTimeout: positiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10_000),
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

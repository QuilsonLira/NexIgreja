import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.mysql";

const globalForMysql = globalThis as typeof globalThis & {
  __NEXIGREJA_MYSQL_POOL?: mysql.Pool;
};

type MysqlConfigurationError = Error & { code: string };

function configurationError(code: string, message: string): MysqlConfigurationError {
  const error = new Error(message) as MysqlConfigurationError;
  error.code = code;
  return error;
}

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

  const missing = [
    !host ? "DB_HOST" : null,
    !user ? "DB_USER" : null,
    password === undefined ? "DB_PASSWORD" : null,
    !database ? "DB_NAME" : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    throw configurationError(
      "NEXIGREJA_MYSQL_ENV_INCOMPLETE",
      `Variáveis MySQL ausentes: ${missing.join(", ")}.`,
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
    throw configurationError(
      "NEXIGREJA_MYSQL_ENV_MISSING",
      "Configure DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ou DATABASE_URL para o backend MySQL.",
    );
  }

  if (!databaseUrl.startsWith("mysql://") && !databaseUrl.startsWith("mysql2://")) {
    throw configurationError(
      "NEXIGREJA_MYSQL_URL_PROTOCOL",
      "DATABASE_URL deve usar o protocolo mysql:// ou mysql2://.",
    );
  }

  const normalizedUrl = databaseUrl.startsWith("mysql2://")
    ? "mysql://" + databaseUrl.slice(9)
    : databaseUrl;

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw configurationError(
      "NEXIGREJA_MYSQL_URL_INVALID",
      "DATABASE_URL está malformada.",
    );
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!parsed.hostname || !parsed.username || !database) {
    throw configurationError(
      "NEXIGREJA_MYSQL_URL_INCOMPLETE",
      "DATABASE_URL precisa conter host, usuário e nome do banco.",
    );
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

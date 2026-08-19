import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import { getAuthConfig } from "@/lib/auth/config";

declare global {
  var nexigrejaPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.nexigrejaPool) {
    globalThis.nexigrejaPool = mysql.createPool({
      uri: getAuthConfig().databaseUrl,
      connectionLimit: 10,
      enableKeepAlive: true,
      timezone: "Z",
      decimalNumbers: true,
      supportBigNumbers: true,
      namedPlaceholders: false,
      multipleStatements: false
    });
  }
  return globalThis.nexigrejaPool;
}

export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

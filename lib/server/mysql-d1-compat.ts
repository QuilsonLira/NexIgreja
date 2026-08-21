import type {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { getMysqlPool } from "@/db/mysql";

type ReturningPlan = {
  mutationSql: string;
  selectSql: string;
  selectBindings: unknown[];
};

function normalizeBinding(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

function splitCommaList(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      current += char;
      if (char === quote && value[index - 1] !== "\\") quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function buildReturningPlan(sql: string, bindings: unknown[]): ReturningPlan | null {
  const match = sql.match(
    /^\s*INSERT\s+INTO\s+([A-Za-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s+ON\s+CONFLICT\s*\(([^)]+)\)[\s\S]*?\s+RETURNING\s+([A-Za-z0-9_,\s]+)\s*$/i,
  );
  if (!match) return null;

  const [, tableName, insertColumnsRaw, valuesRaw, conflictColumnsRaw, returningRaw] = match;
  const insertColumns = splitCommaList(insertColumnsRaw).map((value) => value.replace(/[`"']/g, "").trim());
  const valueTokens = splitCommaList(valuesRaw);
  const conflictColumns = splitCommaList(conflictColumnsRaw).map((value) => value.replace(/[`"']/g, "").trim());
  const returningColumns = splitCommaList(returningRaw).map((value) => value.replace(/[`"']/g, "").trim());

  const bindingForColumn = new Map<string, unknown>();
  let bindingIndex = 0;
  for (let index = 0; index < insertColumns.length; index += 1) {
    const token = valueTokens[index] ?? "";
    const placeholders = (token.match(/\?/g) ?? []).length;
    if (token.trim() === "?" && placeholders === 1) {
      bindingForColumn.set(insertColumns[index], bindings[bindingIndex]);
    }
    bindingIndex += placeholders;
  }

  const selectBindings: unknown[] = [];
  const predicates = conflictColumns.map((column) => {
    if (!bindingForColumn.has(column)) {
      throw new Error(`Cannot emulate RETURNING: conflict column ${column} is not bound directly`);
    }
    selectBindings.push(bindingForColumn.get(column));
    return `\`${column}\` <=> ?`;
  });

  const safeReturning = returningColumns.map((column) => `\`${column}\``).join(", ");
  return {
    mutationSql: sql.replace(/\s+RETURNING\s+[A-Za-z0-9_,\s]+\s*$/i, ""),
    selectSql: `SELECT ${safeReturning} FROM \`${tableName}\` WHERE ${predicates.join(" AND ")} LIMIT 1`,
    selectBindings,
  };
}

function translateReplace(sql: string): string {
  const match = sql.match(/^\s*INSERT\s+OR\s+REPLACE\s+INTO\s+([A-Za-z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*$/i);
  if (!match) return sql.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, "REPLACE INTO");
  const [, table, columnsRaw, valuesRaw] = match;
  const columns = splitCommaList(columnsRaw).map((column) => column.replace(/[`"']/g, "").trim());
  const assignments = columns.map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(",");
  return `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(",")}) VALUES (${valuesRaw}) ON DUPLICATE KEY UPDATE ${assignments}`;
}

function translateOnConflict(sql: string): string {
  return sql.replace(
    /ON\s+CONFLICT\s*\([^)]*\)\s+DO\s+UPDATE\s+SET\s+([\s\S]+)$/i,
    (_full, assignments: string) => {
      let converted = assignments.replace(/\bexcluded\.([A-Za-z0-9_]+)\b/gi, "VALUES($1)");
      converted = converted.replace(
        /\bMAX\s*\(\s*([^,()]+)\s*,\s*VALUES\(([^)]+)\)\s*\)/gi,
        "GREATEST($1,VALUES($2))",
      );
      return `ON DUPLICATE KEY UPDATE ${converted}`;
    },
  );
}

function translateJsonEach(sql: string): string {
  return sql.replace(
    /SELECT\s+value\s+FROM\s+json_each\(\((SELECT[\s\S]*?LIMIT\s+1)\)\)/gi,
    (_full, subquery: string) =>
      `SELECT jt.value FROM JSON_TABLE((${subquery}), '$[*]' COLUMNS (value BIGINT PATH '$')) AS jt`,
  );
}

function translateConcatenation(sql: string): string {
  let current = sql;
  const concat = /('(?:''|[^'])*'|[A-Za-z_][A-Za-z0-9_.]*)\s*\|\|\s*('(?:''|[^'])*'|[A-Za-z_][A-Za-z0-9_.]*)/g;
  for (let pass = 0; pass < 8 && concat.test(current); pass += 1) {
    concat.lastIndex = 0;
    current = current.replace(concat, "CONCAT($1,$2)");
  }
  return current;
}

export function translateSqlForMysql(input: string): string {
  let sql = input.trim();
  sql = translateReplace(sql);
  sql = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT IGNORE INTO");
  sql = sql.replace(/\s+COLLATE\s+NOCASE\b/gi, "");
  sql = sql.replace(/\bdate\s*\(\s*['"]now['"]\s*\)/gi, "CURRENT_DATE()");
  sql = sql.replace(/\bprintf\s*\(\s*['"]%06d['"]\s*,\s*([^)]+)\)/gi, "LPAD($1,6,'0')");
  sql = sql.replace(/\b([A-Za-z_][A-Za-z0-9_.]*)\s+IS\s+\?/gi, "$1 <=> ?");
  sql = sql.replace(/GROUP_CONCAT\(\s*([^,()]+)\s*,\s*'([^']*)'\s*\)/gi, "GROUP_CONCAT($1 SEPARATOR '$2')");
  sql = translateJsonEach(sql);
  sql = translateConcatenation(sql);
  sql = translateOnConflict(sql);
  return sql;
}

function asD1Result<T>(rows: T[], affectedRows = 0, insertId = 0): D1Result<T> {
  return {
    results: rows,
    success: true,
    meta: {
      changes: affectedRows,
      last_row_id: insertId,
    },
  };
}

function resultHeader(value: unknown): ResultSetHeader | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const candidate = value as Partial<ResultSetHeader>;
  return typeof candidate.affectedRows === "number" ? (value as ResultSetHeader) : null;
}

class MySqlPreparedStatement implements D1PreparedStatement {
  constructor(
    private readonly sql: string,
    private readonly bindings: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new MySqlPreparedStatement(this.sql, values.map(normalizeBinding));
  }

  private async execute(executor: Pool | PoolConnection): Promise<[unknown, unknown]> {
    return executor.execute(
      translateSqlForMysql(this.sql),
      this.bindings as never,
    ) as Promise<[unknown, unknown]>;
  }

  private async firstWithReturning<T>(): Promise<T | null> {
    const plan = buildReturningPlan(this.sql, this.bindings);
    if (!plan) return null;
    const connection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        translateSqlForMysql(plan.mutationSql),
        this.bindings as never,
      );
      const [rows] = await connection.execute<RowDataPacket[]>(
        plan.selectSql,
        plan.selectBindings.map(normalizeBinding) as never,
      );
      await connection.commit();
      return (rows[0] as T | undefined) ?? null;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    if (/\sRETURNING\s/i.test(this.sql)) {
      const returning = await this.firstWithReturning<Record<string, unknown>>();
      if (!returning) return null;
      if (column) return (returning[column] as T | undefined) ?? null;
      return returning as T;
    }
    const [rows] = await this.execute(getMysqlPool());
    if (!Array.isArray(rows)) return null;
    const first = (rows as RowDataPacket[])[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    if (column) return (first[column] as T | undefined) ?? null;
    return first as T;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const [rows] = await this.execute(getMysqlPool());
    if (!Array.isArray(rows)) {
      const header = resultHeader(rows);
      return asD1Result<T>([], header?.affectedRows ?? 0, Number(header?.insertId ?? 0));
    }
    return asD1Result(rows as T[]);
  }

  async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const [rows] = await this.execute(getMysqlPool());
    if (Array.isArray(rows)) return asD1Result(rows as T[]);
    const header = resultHeader(rows);
    return asD1Result<T>([], header?.affectedRows ?? 0, Number(header?.insertId ?? 0));
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const [rows] = await this.execute(getMysqlPool());
    if (!Array.isArray(rows)) return [];
    return (rows as RowDataPacket[]).map((row) => Object.values(row) as T);
  }

  async executeOn(executor: PoolConnection): Promise<D1Result<Record<string, unknown>>> {
    const [rows] = await this.execute(executor);
    if (Array.isArray(rows)) return asD1Result(rows as Record<string, unknown>[]);
    const header = resultHeader(rows);
    return asD1Result([], header?.affectedRows ?? 0, Number(header?.insertId ?? 0));
  }
}

class MySqlD1CompatDatabase implements D1Database {
  prepare(query: string): D1PreparedStatement {
    return new MySqlPreparedStatement(query);
  }

  async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const connection: PoolConnection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const results: D1Result<T>[] = [];
      for (const statement of statements) {
        if (!(statement instanceof MySqlPreparedStatement)) {
          throw new Error("MySQL batch received an incompatible prepared statement");
        }
        results.push((await statement.executeOn(connection)) as D1Result<T>);
      }
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const started = performance.now();
    const [rows] = await getMysqlPool().execute(translateSqlForMysql(query));
    const header = resultHeader(rows);
    return {
      count: header?.affectedRows ?? (Array.isArray(rows) ? rows.length : 0),
      duration: performance.now() - started,
    };
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error("D1 dump() is not available on the MySQL backend");
  }
}

const mysqlCompatDatabase = new MySqlD1CompatDatabase();

export function isMysqlBackendConfigured(): boolean {
  const enabled = /^(1|true|yes|on)$/i.test(process.env.MYSQL_RUNTIME_ENABLED?.trim() ?? "");
  if (!enabled) return false;
  const value = process.env.DATABASE_URL?.trim() ?? "";
  return value.startsWith("mysql://") || value.startsWith("mysql2://");
}

export function getMysqlD1CompatDatabase(): D1Database {
  return mysqlCompatDatabase;
}

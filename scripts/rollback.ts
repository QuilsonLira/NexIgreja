import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import mysql, { type RowDataPacket } from "mysql2/promise";

loadEnvConfig(process.cwd());

interface MigrationRow extends RowDataPacket {
  nome: string;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("mysql://")) {
    throw new Error("Defina DATABASE_URL com uma conexao MySQL valida.");
  }

  const connection = await mysql.createConnection({
    uri: databaseUrl,
    timezone: "Z",
    multipleStatements: true
  });

  try {
    const [rows] = await connection.query<MigrationRow[]>(
      "SELECT nome FROM schema_migrations ORDER BY executada_em DESC LIMIT 1"
    );
    const latest = rows[0]?.nome;
    if (!latest) {
      process.stdout.write("Nao ha migration para reverter.\n");
      return;
    }
    if (process.env.CONFIRM_ROLLBACK !== latest) {
      throw new Error(`Para confirmar, defina CONFIRM_ROLLBACK=${latest}`);
    }

    const downFile = latest.replace(/\.up\.sql$/, ".down.sql");
    const sql = await readFile(join(process.cwd(), "migrations", downFile), "utf8");
    await connection.query(sql);
    await connection.execute("DELETE FROM schema_migrations WHERE nome = ?", [latest]);
    process.stdout.write(`Migration revertida: ${latest}\n`);
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  process.stderr.write(`Falha ao reverter migration: ${message}\n`);
  process.exitCode = 1;
});

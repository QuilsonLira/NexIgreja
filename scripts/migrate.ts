import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import mysql, { type RowDataPacket } from "mysql2/promise";

loadEnvConfig(process.cwd());

interface MigrationRow extends RowDataPacket {
  nome: string;
  checksum: string;
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
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nome VARCHAR(255) NOT NULL PRIMARY KEY,
        checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        executada_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    const migrationDirectory = join(process.cwd(), "migrations");
    const files = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith(".up.sql"))
      .sort();

    const [appliedRows] = await connection.query<MigrationRow[]>(
      "SELECT nome, checksum FROM schema_migrations"
    );
    const applied = new Map(appliedRows.map((row) => [row.nome, row.checksum]));

    for (const file of files) {
      const sql = await readFile(join(migrationDirectory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previousChecksum = applied.get(file);

      if (previousChecksum) {
        if (previousChecksum !== checksum) {
          throw new Error(`A migration ja executada foi alterada: ${file}`);
        }
        continue;
      }

      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.execute(
          "INSERT INTO schema_migrations (nome, checksum) VALUES (?, ?)",
          [file, checksum]
        );
        await connection.commit();
        process.stdout.write(`Migration aplicada: ${file}\n`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  process.stderr.write(`Falha ao aplicar migrations: ${message}\n`);
  process.exitCode = 1;
});

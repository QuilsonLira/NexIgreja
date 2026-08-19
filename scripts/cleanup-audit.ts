import { loadEnvConfig } from "@next/env";
import { getPool } from "@/lib/db/mysql";

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const pool = getPool();
  const [auditResult] = await pool.execute(
    "DELETE FROM auditoria_autenticacao WHERE criado_em < UTC_TIMESTAMP() - INTERVAL 90 DAY"
  );
  const [adminAuditResult] = await pool.execute(
    "DELETE FROM auditoria_administracao WHERE criado_em < UTC_TIMESTAMP() - INTERVAL 90 DAY"
  );
  await pool.execute(
    "DELETE FROM autenticacao_tentativas WHERE ultima_falha_em < UTC_TIMESTAMP() - INTERVAL 90 DAY"
  );
  await pool.execute(
    "DELETE FROM sessoes_usuario WHERE expira_em < UTC_TIMESTAMP() - INTERVAL 90 DAY"
  );
  const affectedRows = (auditResult as { affectedRows: number }).affectedRows;
  const adminAffectedRows = (adminAuditResult as { affectedRows: number }).affectedRows;
  process.stdout.write(
    `Registros antigos de auditoria removidos: ${affectedRows + adminAffectedRows}\n`
  );
  await pool.end();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  process.stderr.write(`Falha na limpeza de retencao: ${message}\n`);
  process.exitCode = 1;
});

import { loadEnvConfig } from "@next/env";
import { getAuthConfig } from "@/lib/auth/config";
import { cpfLookupHash } from "@/lib/auth/crypto";
import { classifyIdentifier } from "@/lib/auth/identifier";
import { hashPassword, validateNewPassword } from "@/lib/auth/password";
import { withTransaction } from "@/lib/db/mysql";

loadEnvConfig(process.cwd());

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Defina ${name} antes de criar o administrador.`);
  return value;
}

async function main(): Promise<void> {
  const config = getAuthConfig();
  const conventionName = required("ADMIN_CONVENTION_NAME").trim();
  const name = required("ADMIN_NAME").trim();
  const usernameCredential = classifyIdentifier(required("ADMIN_USERNAME"));
  const emailCredential = classifyIdentifier(required("ADMIN_EMAIL"));
  const cpfCredential = classifyIdentifier(required("ADMIN_CPF"));
  const password = required("ADMIN_PASSWORD");

  if (usernameCredential.type !== "USUARIO") throw new Error("ADMIN_USERNAME invalido.");
  if (emailCredential.type !== "EMAIL") throw new Error("ADMIN_EMAIL invalido.");
  if (cpfCredential.type !== "CPF") throw new Error("ADMIN_CPF invalido.");

  const passwordErrors = validateNewPassword(password);
  if (passwordErrors.length) throw new Error(passwordErrors.join(" "));

  const passwordHash = await hashPassword(password);
  const cpfHash = cpfLookupHash(cpfCredential.normalized, config.cpfLookupHmacKey);

  await withTransaction(async (connection) => {
    const [conventionResult] = await connection.execute(
      "INSERT INTO convencoes (nome, status) VALUES (?, 'ATIVO')",
      [conventionName]
    );
    const conventionId = (conventionResult as { insertId: number }).insertId;

    const [userResult] = await connection.execute(
      `INSERT INTO usuarios (
        convencao_id, nome, nome_usuario, email, cpf_lookup_hash,
        cpf_ultimos_digitos, senha_hash, funcao, status,
        escopo_organizacional, troca_senha_obrigatoria
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Administrador', 'ATIVO', 'CONVENCAO', TRUE)`,
      [
        conventionId,
        name,
        usernameCredential.normalized,
        emailCredential.normalized,
        cpfHash,
        cpfCredential.normalized.slice(-2),
        passwordHash
      ]
    );
    const userId = (userResult as { insertId: number }).insertId;
    await connection.execute(
      `INSERT INTO usuario_permissoes_diretas (
        usuario_id, permissao_id, concedida_por_usuario_id
      )
      SELECT ?, id, ? FROM permissoes
      WHERE codigo IN (
        'USUARIOS_VISUALIZAR', 'USUARIOS_CRIAR', 'USUARIOS_EDITAR',
        'USUARIOS_DESATIVAR', 'USUARIOS_REDEFINIR_SENHA',
        'UNIDADES_VISUALIZAR', 'UNIDADES_CRIAR', 'UNIDADES_EDITAR',
        'ACESSOS_VISUALIZAR'
      )`,
      [userId, userId]
    );
  });

  process.stdout.write(
    "Administrador da Convencao criado. A senha nao foi exibida e devera ser trocada no primeiro acesso.\n"
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Falha desconhecida";
  process.stderr.write(`Nao foi possivel criar o administrador: ${message}\n`);
  process.exitCode = 1;
});

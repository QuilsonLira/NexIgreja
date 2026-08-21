# Configuração MySQL 8

## Estado atual

A migração do NexIgreja para MySQL está isolada na branch `mysql-migration` até a aplicação segura no banco da Hostinger.

A branch já contém:

- `mysql2` e pool de conexões usando `DATABASE_URL`;
- runtime MySQL protegido por `MYSQL_RUNTIME_ENABLED=true`;
- camada de compatibilidade para a interface D1 usada pelos módulos existentes;
- schema MySQL das 85 tabelas;
- SQLite `INTEGER` preservado como MySQL `BIGINT` (booleanos continuam `BOOLEAN`);
- DDL gerado em `drizzle-mysql/`;
- correções de unicidade parcial em `003_partial_unique_constraints.sql`;
- normalização de nomes de constraints/índices para o limite de 64 caracteres do MySQL;
- runner idempotente de migrations com checksum;
- importador SQLite/D1 -> MySQL com preflight, transação, preservação de BLOBs e IDs;
- verificação posterior de contagens, chaves estrangeiras e hash do conteúdo de cada tabela;
- teste automático contra MySQL 8 real no GitHub Actions;
- build nativo do Next.js validado com o runtime MySQL habilitado.

A validação automatizada cria a estrutura completa em um MySQL 8 vazio, aplica as migrations, importa uma base SQLite de teste contendo ID de 16 dígitos e BLOB, confere paridade completa dos dados e compila o Next.js usando o backend MySQL.

## Configuração na Hostinger

A conexão deve existir somente como variável de ambiente do backend:

```text
DATABASE_URL=mysql://usuario:senha@servidor:3306/nome_do_banco
```

O aplicativo só passa a usar o MySQL quando esta variável também estiver definida:

```text
MYSQL_RUNTIME_ENABLED=true
```

**Não habilite `MYSQL_RUNTIME_ENABLED` antes de concluir a estrutura e a cópia dos dados reais.** A presença isolada de `DATABASE_URL` não troca mais o runtime.

Nunca grave usuário, senha ou a `DATABASE_URL` real no GitHub.

Variáveis opcionais do pool:

```text
DB_POOL_SIZE=10
DB_POOL_MAX_IDLE=10
DB_POOL_IDLE_TIMEOUT_MS=60000
```

## Comandos oficiais da migração

Verificar a conexão:

```bash
npm run db:mysql:ping
```

Ver o estado das migrations:

```bash
npm run db:mysql:status
```

Aplicar migrations pendentes:

```bash
npm run db:mysql:migrate
```

Fazer somente o preflight do banco SQLite/D1, sem copiar dados:

```bash
npm run db:mysql:import:preflight -- /caminho/banco.sqlite
```

Copiar os dados para um MySQL vazio:

```bash
npm run db:mysql:import -- /caminho/banco.sqlite
```

Revalidar uma cópia já feita, sem gravar nada:

```bash
npm run db:mysql:verify -- /caminho/banco.sqlite
```

O `verify` compara contagens, relações por chave estrangeira e um SHA-256 normalizado do conteúdo compartilhado de cada tabela, incluindo BLOBs e JSON.

## Fonte oficial da estrutura

Para a migração atual, a estrutura canônica é:

1. SQL gerado em `drizzle-mysql/*.sql`;
2. `database/mysql/003_partial_unique_constraints.sql`.

Os arquivos antigos `001_auth_foundation.sql`, `002_administration.sql` e `002_test_seed.sql` permanecem apenas como histórico da preparação inicial. Não use `002_test_seed.sql` no banco real.

## Ordem segura para produção

1. Manter o D1/SQLite original intacto e obter uma exportação `.sqlite` dele.
2. Manter `MYSQL_RUNTIME_ENABLED` ausente ou `false`.
3. Confirmar que o MySQL da Hostinger não possui dados de aplicação que precisem ser preservados.
4. Aplicar `npm run db:mysql:migrate`.
5. Executar `npm run db:mysql:import:preflight -- banco.sqlite`.
6. Executar `npm run db:mysql:import -- banco.sqlite`.
7. Executar `npm run db:mysql:verify -- banco.sqlite` e exigir `SQLITE_TO_MYSQL_VERIFY_OK`.
8. Conferir registros críticos do sistema (tenant, unidades, usuários, membros e financeiro).
9. Somente então definir `MYSQL_RUNTIME_ENABLED=true` na Hostinger e reimplantar/reiniciar a aplicação.
10. Manter o D1 antigo preservado como rollback até o MySQL passar pelo período de validação.

Não apague nem sobrescreva o banco antigo durante essa transição.

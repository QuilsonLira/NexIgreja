# Configuração MySQL 8

## Estado atual

A migração do NexIgreja para MySQL está isolada na branch `mysql-migration` até a aplicação segura no banco da Hostinger.

A branch já contém:

- `mysql2` e pool de conexões usando `DATABASE_URL`;
- runtime que escolhe MySQL automaticamente quando `DATABASE_URL` usa `mysql://`;
- camada de compatibilidade para a interface D1 usada pelos módulos existentes;
- schema MySQL das 85 tabelas;
- DDL gerado em `drizzle-mysql/`;
- correções de unicidade parcial em `003_partial_unique_constraints.sql`;
- normalização de nomes de constraints/índices para o limite de 64 caracteres do MySQL;
- runner idempotente de migrations com checksum;
- teste automático contra MySQL 8 real no GitHub Actions;
- build nativo do Next.js validado com configuração MySQL.

A validação automatizada já conseguiu criar a estrutura completa em um MySQL 8 vazio, conferir tabelas essenciais e compilar o Next.js usando o backend MySQL.

## Configuração na Hostinger

A conexão deve existir somente como variável de ambiente do backend:

```text
DATABASE_URL=mysql://usuario:senha@servidor:3306/nome_do_banco
```

Nunca grave usuário, senha ou a `DATABASE_URL` real no GitHub.

Variáveis opcionais do pool:

```text
DB_POOL_SIZE=10
DB_POOL_MAX_IDLE=10
DB_POOL_IDLE_TIMEOUT_MS=60000
```

## Comandos oficiais da migração

Verificar a conexão e a estrutura mínima:

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

O runner cria `_nexigreja_migrations`, registra checksum de cada arquivo aplicado e recusa executar o baseline automaticamente se detectar um banco já preenchido sem histórico de migration.

## Fonte oficial da estrutura

Para a migração atual, a estrutura canônica é:

1. SQL gerado em `drizzle-mysql/*.sql`;
2. `database/mysql/003_partial_unique_constraints.sql`.

Os arquivos antigos `001_auth_foundation.sql`, `002_administration.sql` e `002_test_seed.sql` permanecem apenas como histórico da preparação inicial. Não use `002_test_seed.sql` no banco real.

## Ordem segura para produção

1. Manter o banco D1/SQLite original intacto como fonte dos dados existentes.
2. Confirmar que o banco MySQL da Hostinger está vazio ou revisar qualquer tabela já existente.
3. Aplicar `npm run db:mysql:migrate` no banco MySQL.
4. Confirmar `npm run db:mysql:status` e `npm run db:mysql:ping`.
5. Só então integrar a branch MySQL na `main` e implantar o aplicativo apontando para esse banco.
6. Migrar os dados D1/SQLite para MySQL preservando IDs, relacionamentos e escopo de tenant.
7. Comparar contagens e registros críticos antes de desativar o banco antigo.

Não apague nem sobrescreva o banco antigo durante essa transição.

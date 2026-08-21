# Configuração MySQL 8

## Estado da migração

A migração para MySQL está sendo feita na branch `mysql-migration` para não interromper a versão atual enquanto o schema completo ainda usa SQLite/D1.

A primeira etapa já contém:

- driver `mysql2`;
- adaptador `db/mysql.ts` usando `DATABASE_URL`;
- pool de conexões para o backend;
- teste de conectividade `npm run db:mysql:ping`;
- scripts SQL MySQL já existentes nesta pasta.

O adaptador D1 atual não deve ser removido até que todo `db/schema.ts` e as consultas dependentes sejam convertidos e validados para MySQL.

## Configuração na Hostinger

Use uma variável de ambiente apenas no backend:

```text
DATABASE_URL=mysql://usuario:senha@servidor:3306/nexigreja
```

Nunca grave usuário, senha ou a `DATABASE_URL` real no GitHub.

Variáveis opcionais do pool:

```text
DB_POOL_SIZE=10
DB_POOL_MAX_IDLE=10
DB_POOL_IDLE_TIMEOUT_MS=60000
```

## Teste da conexão

Depois de instalar as dependências da branch e com `DATABASE_URL` configurada:

```bash
npm run db:mysql:ping
```

Sucesso esperado:

```text
MYSQL_CONNECTION_OK
database=<nome-do-banco>
version=<versao-mysql>
```

O comando não imprime a senha nem a string de conexão.

## Estrutura SQL existente

1. `001_auth_foundation.sql` contém a fundação inicial de autenticação em MySQL.
2. `002_administration.sql` contém a estrutura administrativa complementar existente.
3. `002_test_seed.sql` é somente para ambiente de teste e não deve ser usado no banco real sem revisão.

Não execute os scripts no banco de produção antes de concluir a compatibilização do schema e preparar o plano de importação dos dados D1/SQLite.

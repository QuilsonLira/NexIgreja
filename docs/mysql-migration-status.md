# Migração MySQL — status

Esta branch isola a migração do backend D1/SQLite para MySQL 8.

## Já preparado

- `mysql2` como driver Node.js.
- `db/mysql.ts` com pool de conexões usando `DATABASE_URL`.
- `scripts/mysql-ping.mjs` para teste simples de conectividade.
- `scripts/generate-mysql-schema.mjs` para gerar `db/schema.mysql.ts` a partir do schema SQLite.
- `drizzle.mysql.config.ts` separado do histórico SQLite.
- workflow de validação da conversão.

## Regra de segurança

A branch `main` não deve trocar para MySQL enquanto a validação TypeScript e a estrutura MySQL completa não estiverem aprovadas. Nenhum script desta branch apaga ou altera o banco D1 antigo.

## Próximas etapas

1. Validar o schema MySQL gerado no CI.
2. Corrigir incompatibilidades específicas de MySQL.
3. Completar o DDL MySQL de todas as tabelas.
4. Trocar `db/index.ts` para MySQL apenas nesta branch.
5. Validar build do aplicativo.
6. Executar migrations no banco vazio da Hostinger.
7. Exportar e importar os dados do D1 preservando IDs e relacionamentos.
8. Fazer verificação de contagens, chaves estrangeiras e login antes de liberar produção.

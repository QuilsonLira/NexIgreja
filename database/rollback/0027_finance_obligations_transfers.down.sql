DROP INDEX IF EXISTS finance_transfers_scope_status_idx;
DROP INDEX IF EXISTS finance_installments_account_settled_idx;
DROP INDEX IF EXISTS finance_installments_obligation_status_idx;
DROP INDEX IF EXISTS finance_obligations_scope_status_idx;
DELETE FROM help_articles WHERE version='38';
-- SQLite não remove colunas com segurança em rollback incremental; os dados históricos são preservados.

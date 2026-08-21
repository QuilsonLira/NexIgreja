DROP INDEX IF EXISTS `finance_movements_original_idx`;
DROP INDEX IF EXISTS `people_finance_hierarchy_search_idx`;
DELETE FROM `membership_permissions` WHERE `permission` IN ('FINANCEIRO_LANCAMENTOS_EDITAR_ABERTO','FINANCEIRO_LANCAMENTOS_EXCLUIR_ABERTO','FINANCEIRO_CONTRIBUINTES_FILIAIS_PESQUISAR');
DELETE FROM `user_permissions` WHERE `permission` IN ('FINANCEIRO_LANCAMENTOS_EDITAR_ABERTO','FINANCEIRO_LANCAMENTOS_EXCLUIR_ABERTO');
DELETE FROM `help_articles` WHERE `id` BETWEEN 25001 AND 25009;
-- As colunas incrementais de finance_movements são preservadas no rollback para evitar
-- reconstrução destrutiva da tabela e perda de movimentos financeiros existentes.

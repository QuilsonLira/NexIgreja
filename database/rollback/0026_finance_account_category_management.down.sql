DROP INDEX IF EXISTS `finance_payment_methods_filter_idx`;
DROP INDEX IF EXISTS `finance_cost_centers_filter_idx`;
DELETE FROM `help_articles` WHERE `id` BETWEEN 26001 AND 26016;
-- As colunas incrementais são preservadas para que um rollback nunca apague
-- dados cadastrais, informações de arquivamento ou ajustes financeiros.

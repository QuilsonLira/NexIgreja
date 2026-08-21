DROP INDEX IF EXISTS `finance_period_allocation_results_destination_idx`;
DELETE FROM `help_articles` WHERE `id` IN (32001,32002);
-- As colunas aditivas são mantidas para não perder a destinação registrada nos snapshots.

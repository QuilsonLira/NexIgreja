DROP INDEX IF EXISTS `secretary_transfer_search_limits_window_idx`;
DROP TABLE IF EXISTS `secretary_transfer_search_limits`;
DROP INDEX IF EXISTS `secretary_requests_pending_destination_idx`;
DELETE FROM `help_article_reads` WHERE `article_id` IN (24001,24002,24003);
DELETE FROM `help_articles` WHERE `id` IN (24001,24002,24003);
-- SQLite exige reconstrução de secretary_requests para remover request_direction; o rollback preserva a coluna compatível.

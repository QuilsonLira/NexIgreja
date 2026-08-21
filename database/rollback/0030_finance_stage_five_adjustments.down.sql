DROP INDEX IF EXISTS `finance_funds_scope_archive_idx`;
DROP INDEX IF EXISTS `finance_campaigns_scope_archive_idx`;
DROP INDEX IF EXISTS `finance_movements_fund_period_idx`;
DROP INDEX IF EXISTS `finance_movements_campaign_period_idx`;
DROP INDEX IF EXISTS `finance_movements_period_status_idx`;
DROP INDEX IF EXISTS `finance_movements_period_page_idx`;
DELETE FROM `help_articles` WHERE `id` BETWEEN 30001 AND 30013;
-- SQLite/D1 does not safely drop individual columns in a rollback migration.
-- The nullable metadata columns are intentionally retained to preserve data.

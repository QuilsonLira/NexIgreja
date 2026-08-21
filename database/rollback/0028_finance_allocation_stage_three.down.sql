DROP INDEX IF EXISTS `finance_period_allocation_results_idx`;
DROP INDEX IF EXISTS `finance_period_rule_versions_idx`;
DROP INDEX IF EXISTS `finance_allocation_config_versions_scope_idx`;
DROP TABLE IF EXISTS `finance_period_allocation_results`;
DROP TABLE IF EXISTS `finance_period_allocation_rule_versions`;
DROP TABLE IF EXISTS `finance_allocation_config_versions`;
DELETE FROM `help_articles` WHERE `version`='39';
-- SQLite keeps the additive finance_closure_versions columns during rollback.

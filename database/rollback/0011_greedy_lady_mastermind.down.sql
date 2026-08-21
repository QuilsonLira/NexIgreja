UPDATE `tenant_memberships`
SET `role_name` = COALESCE((SELECT `name` FROM `organizational_functions` WHERE `id` = `tenant_memberships`.`function_id`), `role_name`);--> statement-breakpoint
DROP TRIGGER IF EXISTS `tenant_memberships_function_update_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `tenant_memberships_function_insert_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `organizational_units_parent_cnpj_update_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `organizational_units_parent_cnpj_insert_guard`;--> statement-breakpoint
DROP INDEX IF EXISTS `organizational_units_tenant_own_cnpj_unique`;--> statement-breakpoint
ALTER TABLE `tenant_memberships` DROP COLUMN `function_id`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `uses_parent_cnpj`;--> statement-breakpoint
DROP TABLE `organizational_functions`;

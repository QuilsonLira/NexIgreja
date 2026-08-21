ALTER TABLE `audit_logs` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `audit_logs` SET `tenant_id` = COALESCE(
  (SELECT `tenant_id` FROM `auth_users` WHERE `id` = `audit_logs`.`user_id`),
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `audit_logs`.`branch_id`),
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `audit_logs`.`matrix_id`)
) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `audit_logs_tenant_idx` ON `audit_logs` (`tenant_id`, `created_at`);

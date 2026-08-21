-- Introduces the SaaS tenant boundary above Convenção -> Matriz -> Filial.
-- Columns are added nullable because SQLite cannot add a required column to a
-- populated table; backfill plus triggers enforce required ownership safely.
CREATE TABLE `tenants` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'ATIVO' NOT NULL CHECK (`status` IN ('ATIVO', 'SUSPENSO', 'CANCELADO')),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_slug_unique` ON `tenants` (`slug`);
--> statement-breakpoint
INSERT INTO `tenants` (`id`, `name`, `slug`, `status`, `created_at`, `updated_at`)
VALUES (1, 'Organização inicial NexIgreja', 'organizacao-inicial', 'ATIVO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
--> statement-breakpoint
ALTER TABLE `organizational_units` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `organizational_units` SET `tenant_id` = 1 WHERE `tenant_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `auth_users` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `auth_users` SET `tenant_id` = 1 WHERE `tenant_id` IS NULL;
--> statement-breakpoint
UPDATE `auth_users` SET `tenant_id` = NULL WHERE `id` IN (SELECT `user_id` FROM `platform_owners`);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `auth_sessions` SET `tenant_id` = COALESCE(
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `auth_sessions`.`selected_unit_id`),
  (SELECT `tenant_id` FROM `auth_users` WHERE `id` = `auth_sessions`.`user_id`),
  1
) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `login_history` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `login_history` SET `tenant_id` = (SELECT `tenant_id` FROM `auth_users` WHERE `id` = `login_history`.`user_id`) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `administration_audit` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `administration_audit` SET `tenant_id` = COALESCE(
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `administration_audit`.`unit_id`),
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `administration_audit`.`convention_id`),
  1
) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `platform_audit` ADD `tenant_id` integer REFERENCES `tenants`(`id`);
--> statement-breakpoint
UPDATE `platform_audit` SET `tenant_id` = COALESCE(
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `platform_audit`.`unit_id`),
  (SELECT `tenant_id` FROM `organizational_units` WHERE `id` = `platform_audit`.`convention_id`)
) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
DELETE FROM `user_unit_links` WHERE `user_id` IN (SELECT `user_id` FROM `platform_owners`);
--> statement-breakpoint
CREATE INDEX `organizational_units_tenant_idx` ON `organizational_units` (`tenant_id`, `type`, `status`);
--> statement-breakpoint
CREATE INDEX `auth_users_tenant_idx` ON `auth_users` (`tenant_id`, `status`);
--> statement-breakpoint
CREATE INDEX `auth_sessions_tenant_idx` ON `auth_sessions` (`tenant_id`, `user_id`);
--> statement-breakpoint
CREATE TRIGGER `organizational_units_tenant_required_insert`
BEFORE INSERT ON `organizational_units` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `organizational_units_tenant_required_update`
BEFORE UPDATE OF `tenant_id` ON `organizational_units` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `organizational_units_parent_tenant_insert`
BEFORE INSERT ON `organizational_units`
WHEN NEW.`parent_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `organizational_units` parent WHERE parent.`id` = NEW.`parent_id` AND parent.`tenant_id` = NEW.`tenant_id`)
BEGIN SELECT RAISE(ABORT, 'parent belongs to another tenant'); END;
--> statement-breakpoint
CREATE TRIGGER `organizational_units_parent_tenant_update`
BEFORE UPDATE OF `parent_id`, `tenant_id` ON `organizational_units`
WHEN NEW.`parent_id` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `organizational_units` parent WHERE parent.`id` = NEW.`parent_id` AND parent.`tenant_id` = NEW.`tenant_id`)
BEGIN SELECT RAISE(ABORT, 'parent belongs to another tenant'); END;
--> statement-breakpoint
CREATE TRIGGER `auth_sessions_tenant_required_insert`
BEFORE INSERT ON `auth_sessions` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `auth_sessions_tenant_required_update`
BEFORE UPDATE OF `tenant_id` ON `auth_sessions` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `administration_audit_tenant_required_insert`
BEFORE INSERT ON `administration_audit` WHEN NEW.`tenant_id` IS NULL
BEGIN SELECT RAISE(ABORT, 'tenant_id is required'); END;
--> statement-breakpoint
CREATE TRIGGER `user_unit_links_same_tenant_insert`
BEFORE INSERT ON `user_unit_links`
WHEN EXISTS (SELECT 1 FROM `auth_users` user WHERE user.`id` = NEW.`user_id` AND user.`tenant_id` IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM `auth_users` user JOIN `organizational_units` unit ON unit.`id` = NEW.`unit_id` AND unit.`tenant_id` = user.`tenant_id` WHERE user.`id` = NEW.`user_id`)
BEGIN SELECT RAISE(ABORT, 'user and unit belong to different tenants'); END;

ALTER TABLE `tenants` ADD `access_code` text;
--> statement-breakpoint
CREATE TABLE `_institution_code_seed` (`value` integer NOT NULL);
--> statement-breakpoint
INSERT INTO `_institution_code_seed` VALUES (abs(random()) % 9000000);
--> statement-breakpoint
WITH ranked AS (
	SELECT `id`, ROW_NUMBER() OVER (ORDER BY random()) AS position FROM `tenants`
)
UPDATE `tenants` SET `access_code` = printf('%07d', 1000000 + (
	(SELECT `value` FROM `_institution_code_seed`) +
	(SELECT ranked.`position` FROM ranked WHERE ranked.`id` = `tenants`.`id`) * 7919
) % 9000000);
--> statement-breakpoint
DROP TABLE `_institution_code_seed`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_access_code_unique` ON `tenants` (`access_code`);
--> statement-breakpoint
CREATE TRIGGER `tenants_access_code_insert_guard`
BEFORE INSERT ON `tenants`
WHEN NEW.`access_code` IS NULL OR length(NEW.`access_code`) <> 7 OR NEW.`access_code` GLOB '*[^0-9]*'
BEGIN SELECT RAISE(ABORT, 'institution access code must contain exactly 7 digits'); END;
--> statement-breakpoint
CREATE TRIGGER `tenants_access_code_update_guard`
BEFORE UPDATE OF `access_code` ON `tenants`
WHEN NEW.`access_code` IS NULL OR length(NEW.`access_code`) <> 7 OR NEW.`access_code` GLOB '*[^0-9]*'
BEGIN SELECT RAISE(ABORT, 'institution access code must contain exactly 7 digits'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `auth_sessions_tenant_required_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `auth_sessions_tenant_required_update`;
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `platform_context_active` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `auth_sessions`
SET `tenant_id` = NULL, `membership_id` = NULL, `selected_unit_id` = NULL, `platform_context_active` = false
WHERE `user_id` IN (SELECT `user_id` FROM `platform_owners`);
--> statement-breakpoint
CREATE TABLE `tenant_access_contexts` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`tenant_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenant_access_contexts_expiry_idx` ON `tenant_access_contexts` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `institution_lookup_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code_fingerprint` text NOT NULL,
	`success` integer NOT NULL CHECK (`success` IN (0, 1)),
	`ip_address` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `institution_lookup_attempts_ip_created_idx` ON `institution_lookup_attempts` (`ip_address`, `created_at`);
--> statement-breakpoint
CREATE INDEX `institution_lookup_attempts_code_created_idx` ON `institution_lookup_attempts` (`code_fingerprint`, `created_at`);

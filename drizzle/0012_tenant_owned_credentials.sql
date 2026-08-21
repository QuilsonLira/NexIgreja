PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `user_unit_links_same_tenant_insert`;
--> statement-breakpoint
CREATE TABLE `__new_auth_users` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`username` text COLLATE NOCASE NOT NULL CHECK (`username` = lower(`username`)),
	`email` text COLLATE NOCASE NOT NULL CHECK (`email` = lower(`email`)),
	`cpf` text NOT NULL CHECK (length(`cpf`) = 11 AND `cpf` NOT GLOB '*[^0-9]*'),
	`password_hash` text NOT NULL,
	`role_name` text NOT NULL,
	`scope` text NOT NULL CHECK (`scope` IN ('CONVENCAO', 'MATRIZ', 'FILIAL')),
	`status` text DEFAULT 'ATIVO' NOT NULL CHECK (`status` IN ('ATIVO', 'INATIVO')),
	`must_change_password` integer DEFAULT false NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`blocked_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	`archived_by` integer,
	`archived_previous_status` text,
	`tenant_id` integer REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_auth_users` (`id`, `name`, `username`, `email`, `cpf`, `password_hash`, `role_name`, `scope`, `status`, `must_change_password`, `failed_attempts`, `blocked_until`, `created_at`, `updated_at`, `archived_at`, `archived_by`, `archived_previous_status`, `tenant_id`)
SELECT `id`, `name`, lower(`username`), lower(`email`), `cpf`, `password_hash`, `role_name`, `scope`, `status`, `must_change_password`, `failed_attempts`, `blocked_until`, `created_at`, `updated_at`, `archived_at`, `archived_by`, `archived_previous_status`, `tenant_id` FROM `auth_users`;
--> statement-breakpoint
DROP TABLE `auth_users`;
--> statement-breakpoint
ALTER TABLE `__new_auth_users` RENAME TO `auth_users`;
--> statement-breakpoint
CREATE TRIGGER `user_unit_links_same_tenant_insert`
BEFORE INSERT ON `user_unit_links`
WHEN EXISTS (SELECT 1 FROM `auth_users` user WHERE user.`id` = NEW.`user_id` AND user.`tenant_id` IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM `auth_users` user JOIN `organizational_units` unit ON unit.`id` = NEW.`unit_id` AND unit.`tenant_id` = user.`tenant_id` WHERE user.`id` = NEW.`user_id`)
BEGIN SELECT RAISE(ABORT, 'user and unit belong to different tenants'); END;
--> statement-breakpoint
CREATE TABLE `_tenant_identity_split` AS
WITH ranked AS (
	SELECT membership.`id` AS membership_id, membership.`user_id` AS source_user_id,
		membership.`tenant_id`, ROW_NUMBER() OVER (PARTITION BY membership.`user_id` ORDER BY membership.`id`) AS tenant_rank
	FROM `tenant_memberships` membership
	WHERE NOT EXISTS (SELECT 1 FROM `platform_owners` owner WHERE owner.`user_id` = membership.`user_id`)
), clones AS (
	SELECT ranked.*, ROW_NUMBER() OVER (ORDER BY ranked.`source_user_id`, ranked.`membership_id`) AS clone_sequence
	FROM ranked WHERE ranked.`tenant_rank` > 1
)
SELECT clones.`membership_id`, clones.`source_user_id`, clones.`tenant_id`,
	(SELECT COALESCE(MAX(`id`), 0) FROM `auth_users`) + clones.`clone_sequence` AS new_user_id
FROM clones;
--> statement-breakpoint
INSERT INTO `auth_users` (`id`, `name`, `username`, `email`, `cpf`, `password_hash`, `role_name`, `scope`, `status`, `must_change_password`, `failed_attempts`, `blocked_until`, `created_at`, `updated_at`, `archived_at`, `archived_by`, `archived_previous_status`, `tenant_id`)
SELECT split.`new_user_id`, source.`name`, source.`username`, source.`email`, source.`cpf`, source.`password_hash`, source.`role_name`, source.`scope`, source.`status`, source.`must_change_password`, source.`failed_attempts`, source.`blocked_until`, source.`created_at`, source.`updated_at`, source.`archived_at`, source.`archived_by`, source.`archived_previous_status`, split.`tenant_id`
FROM `_tenant_identity_split` split JOIN `auth_users` source ON source.`id` = split.`source_user_id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `user_profile_photos` (`user_id`, `image_data`, `mime_type`, `byte_size`, `updated_at`)
SELECT split.`new_user_id`, photo.`image_data`, photo.`mime_type`, photo.`byte_size`, photo.`updated_at`
FROM `_tenant_identity_split` split JOIN `user_profile_photos` photo ON photo.`user_id` = split.`source_user_id`;
--> statement-breakpoint
INSERT OR IGNORE INTO `user_permissions` (`user_id`, `permission`, `created_at`)
SELECT split.`new_user_id`, permission.`permission`, permission.`created_at`
FROM `_tenant_identity_split` split JOIN `user_permissions` permission ON permission.`user_id` = split.`source_user_id`;
--> statement-breakpoint
UPDATE `tenant_memberships` SET `user_id` = (
	SELECT split.`new_user_id` FROM `_tenant_identity_split` split WHERE split.`membership_id` = `tenant_memberships`.`id`
) WHERE `id` IN (SELECT `membership_id` FROM `_tenant_identity_split`);
--> statement-breakpoint
UPDATE `auth_sessions` SET `user_id` = (
	SELECT membership.`user_id` FROM `tenant_memberships` membership WHERE membership.`id` = `auth_sessions`.`membership_id`
) WHERE `membership_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `administration_audit` SET `actor_user_id` = (
	SELECT membership.`user_id` FROM `tenant_memberships` membership WHERE membership.`id` = `administration_audit`.`actor_membership_id`
) WHERE `actor_membership_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `auth_users` SET `tenant_id` = (
	SELECT membership.`tenant_id` FROM `tenant_memberships` membership
	WHERE membership.`user_id` = `auth_users`.`id` ORDER BY membership.`id` LIMIT 1
) WHERE NOT EXISTS (SELECT 1 FROM `platform_owners` owner WHERE owner.`user_id` = `auth_users`.`id`)
	AND EXISTS (SELECT 1 FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id`);
--> statement-breakpoint
UPDATE `auth_users` SET
	`name` = COALESCE((SELECT membership.`display_name` FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id` LIMIT 1), `name`),
	`role_name` = COALESCE((SELECT membership.`role_name` FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id` LIMIT 1), `role_name`),
	`scope` = COALESCE((SELECT membership.`scope` FROM `tenant_memberships` membership WHERE membership.`user_id` = `auth_users`.`id` LIMIT 1), `scope`)
WHERE `tenant_id` IS NOT NULL;
--> statement-breakpoint
DELETE FROM `user_unit_links` WHERE `user_id` IN (SELECT `id` FROM `auth_users` WHERE `tenant_id` IS NOT NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO `user_unit_links` (`user_id`, `unit_id`, `is_primary`, `created_at`)
SELECT membership.`user_id`, membership.`scope_unit_id`, 1, membership.`created_at`
FROM `tenant_memberships` membership JOIN `auth_users` user ON user.`id` = membership.`user_id`
WHERE user.`tenant_id` = membership.`tenant_id`;
--> statement-breakpoint
UPDATE `tenant_memberships` SET `status` = 'ATIVO', `accepted_at` = COALESCE(`accepted_at`, CURRENT_TIMESTAMP), `updated_at` = CURRENT_TIMESTAMP
WHERE `status` = 'PENDENTE' AND `archived_at` IS NULL;
--> statement-breakpoint
DROP TABLE `_tenant_identity_split`;
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_tenant_username_unique` ON `auth_users` (`tenant_id`, `username`) WHERE `tenant_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_tenant_email_unique` ON `auth_users` (`tenant_id`, `email`) WHERE `tenant_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_tenant_cpf_unique` ON `auth_users` (`tenant_id`, `cpf`) WHERE `tenant_id` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_platform_username_unique` ON `auth_users` (`username`) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_platform_email_unique` ON `auth_users` (`email`) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_platform_cpf_unique` ON `auth_users` (`cpf`) WHERE `tenant_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `auth_users_tenant_status_idx` ON `auth_users` (`tenant_id`, `status`, `archived_at`);
--> statement-breakpoint
PRAGMA defer_foreign_keys = OFF;
--> statement-breakpoint
PRAGMA foreign_key_check;

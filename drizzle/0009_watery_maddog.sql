-- Global identities remain in auth_users. Organizational attributes move to
-- tenant_memberships so one credential can have independent access in many tenants.
CREATE TABLE `tenant_memberships` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`tenant_id` integer NOT NULL,
	`display_name` text NOT NULL,
	`role_name` text NOT NULL,
	`scope` text NOT NULL CHECK (`scope` IN ('CONVENCAO', 'MATRIZ', 'FILIAL')),
	`scope_unit_id` integer NOT NULL,
	`status` text DEFAULT 'ATIVO' NOT NULL CHECK (`status` IN ('ATIVO', 'INATIVO', 'PENDENTE')),
	`invited_by_membership_id` integer,
	`accepted_at` text,
	`archived_at` text,
	`archived_by_membership_id` integer,
	`archived_previous_status` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`),
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
	FOREIGN KEY (`scope_unit_id`) REFERENCES `organizational_units`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_memberships_user_tenant_unique` ON `tenant_memberships` (`user_id`, `tenant_id`);
--> statement-breakpoint
CREATE INDEX `tenant_memberships_tenant_status_idx` ON `tenant_memberships` (`tenant_id`, `status`);
--> statement-breakpoint
CREATE INDEX `tenant_memberships_user_status_idx` ON `tenant_memberships` (`user_id`, `status`);
--> statement-breakpoint
CREATE TABLE `membership_permissions` (
	`membership_id` integer NOT NULL,
	`permission` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY (`membership_id`, `permission`),
	FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`)
);
--> statement-breakpoint
INSERT INTO `tenant_memberships` (`id`, `user_id`, `tenant_id`, `display_name`, `role_name`, `scope`, `scope_unit_id`, `status`, `accepted_at`, `archived_at`, `archived_by_membership_id`, `archived_previous_status`, `created_at`, `updated_at`)
SELECT user.`id`, user.`id`, user.`tenant_id`, user.`name`, user.`role_name`, user.`scope`, link.`unit_id`, user.`status`, user.`created_at`, user.`archived_at`, user.`archived_by`, user.`archived_previous_status`, user.`created_at`, user.`updated_at`
FROM `auth_users` user
JOIN `user_unit_links` link ON link.`user_id` = user.`id` AND link.`is_primary` = 1
WHERE user.`tenant_id` IS NOT NULL;
--> statement-breakpoint
INSERT INTO `membership_permissions` (`membership_id`, `permission`, `created_at`)
SELECT permission.`user_id`, permission.`permission`, permission.`created_at`
FROM `user_permissions` permission
JOIN `tenant_memberships` membership ON membership.`id` = permission.`user_id`;
--> statement-breakpoint
-- Status and archive now belong to memberships. The global identity remains
-- usable when it has another active organization.
UPDATE `auth_users`
SET `status` = 'ATIVO', `archived_at` = NULL, `archived_by` = NULL, `archived_previous_status` = NULL
WHERE `tenant_id` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `membership_id` integer REFERENCES `tenant_memberships`(`id`);
--> statement-breakpoint
UPDATE `auth_sessions` SET `membership_id` = (
  SELECT membership.`id` FROM `tenant_memberships` membership
  WHERE membership.`user_id` = `auth_sessions`.`user_id`
    AND membership.`tenant_id` = `auth_sessions`.`tenant_id`
) WHERE `membership_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `administration_audit` ADD `actor_membership_id` integer REFERENCES `tenant_memberships`(`id`);
--> statement-breakpoint
UPDATE `administration_audit` SET `actor_membership_id` = (
  SELECT membership.`id` FROM `tenant_memberships` membership
  WHERE membership.`user_id` = `administration_audit`.`actor_user_id`
    AND membership.`tenant_id` = `administration_audit`.`tenant_id`
) WHERE `actor_membership_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `auth_sessions_membership_idx` ON `auth_sessions` (`membership_id`, `expires_at`);
--> statement-breakpoint
CREATE TRIGGER `tenant_memberships_scope_unit_insert`
BEFORE INSERT ON `tenant_memberships`
WHEN NOT EXISTS (SELECT 1 FROM `organizational_units` unit WHERE unit.`id` = NEW.`scope_unit_id` AND unit.`tenant_id` = NEW.`tenant_id` AND unit.`type` = NEW.`scope`)
BEGIN SELECT RAISE(ABORT, 'membership scope unit belongs to another tenant or scope'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_memberships_scope_unit_update`
BEFORE UPDATE OF `tenant_id`, `scope`, `scope_unit_id` ON `tenant_memberships`
WHEN NOT EXISTS (SELECT 1 FROM `organizational_units` unit WHERE unit.`id` = NEW.`scope_unit_id` AND unit.`tenant_id` = NEW.`tenant_id` AND unit.`type` = NEW.`scope`)
BEGIN SELECT RAISE(ABORT, 'membership scope unit belongs to another tenant or scope'); END;
--> statement-breakpoint
CREATE TRIGGER `auth_sessions_membership_tenant_insert`
BEFORE INSERT ON `auth_sessions`
WHEN NEW.`membership_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `tenant_memberships` membership
  WHERE membership.`id` = NEW.`membership_id` AND membership.`user_id` = NEW.`user_id` AND membership.`tenant_id` = NEW.`tenant_id`
)
BEGIN SELECT RAISE(ABORT, 'session membership does not match identity and tenant'); END;
--> statement-breakpoint
CREATE TRIGGER `auth_sessions_membership_tenant_update`
BEFORE UPDATE OF `user_id`, `tenant_id`, `membership_id` ON `auth_sessions`
WHEN NEW.`membership_id` IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `tenant_memberships` membership
  WHERE membership.`id` = NEW.`membership_id` AND membership.`user_id` = NEW.`user_id` AND membership.`tenant_id` = NEW.`tenant_id`
)
BEGIN SELECT RAISE(ABORT, 'session membership does not match identity and tenant'); END;

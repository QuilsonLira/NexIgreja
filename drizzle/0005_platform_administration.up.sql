CREATE TABLE `platform_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` integer NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`convention_id` integer,
	`unit_id` integer,
	`ip_address` text,
	`user_agent` text,
	`device_summary` text,
	`details` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `platform_owners` (
	`singleton_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "platform_owners_singleton_check" CHECK("platform_owners"."singleton_id" = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_owners_user_unique` ON `platform_owners` (`user_id`);
--> statement-breakpoint
ALTER TABLE `organizational_units` ADD `archived_at` text;
--> statement-breakpoint
ALTER TABLE `organizational_units` ADD `archived_by` integer;
--> statement-breakpoint
ALTER TABLE `organizational_units` ADD `archived_previous_status` text;
--> statement-breakpoint
INSERT OR IGNORE INTO `platform_owners` (`singleton_id`, `user_id`, `created_at`, `updated_at`)
SELECT 1, `id`, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM `auth_users` WHERE `id` = 1;

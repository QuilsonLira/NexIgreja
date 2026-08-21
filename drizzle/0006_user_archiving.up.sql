ALTER TABLE `auth_users` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `auth_users` ADD `archived_by` integer;--> statement-breakpoint
ALTER TABLE `auth_users` ADD `archived_previous_status` text;--> statement-breakpoint
CREATE INDEX `auth_users_archived_idx` ON `auth_users` (`archived_at`);

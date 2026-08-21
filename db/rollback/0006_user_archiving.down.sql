DROP INDEX IF EXISTS `auth_users_archived_idx`;
--> statement-breakpoint
ALTER TABLE `auth_users` DROP COLUMN `archived_previous_status`;
--> statement-breakpoint
ALTER TABLE `auth_users` DROP COLUMN `archived_by`;
--> statement-breakpoint
ALTER TABLE `auth_users` DROP COLUMN `archived_at`;

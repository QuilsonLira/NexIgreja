DROP TABLE IF EXISTS `platform_audit`;
--> statement-breakpoint
DROP TABLE IF EXISTS `platform_owners`;
--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `archived_previous_status`;
--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `archived_by`;
--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `archived_at`;

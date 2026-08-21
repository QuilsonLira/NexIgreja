DROP INDEX IF EXISTS `organizational_units_cnpj_unique`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `notes`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `foundation_date`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `responsible_name`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `state`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `city`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `district`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `complement`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `number`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `street`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `postal_code`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `email`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `whatsapp`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `phone`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `cnpj`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `legal_name`;--> statement-breakpoint
ALTER TABLE `organizational_units` DROP COLUMN `fantasy_name`;

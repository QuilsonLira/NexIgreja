CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`selected_unit_id` integer,
	`previous_login_at` text,
	`previous_identifier_type` text CHECK (`previous_identifier_type` IS NULL OR `previous_identifier_type` IN ('CPF', 'USUARIO', 'EMAIL')),
	`previous_device_summary` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_unit_id`) REFERENCES `organizational_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `auth_users` (
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
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_username_unique` ON `auth_users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_email_unique` ON `auth_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_cpf_unique` ON `auth_users` (`cpf`);--> statement-breakpoint
CREATE INDEX `auth_users_status_idx` ON `auth_users` (`status`);--> statement-breakpoint
CREATE TABLE `login_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`identifier_type` text NOT NULL CHECK (`identifier_type` IN ('CPF', 'USUARIO', 'EMAIL')),
	`identifier_fingerprint` text NOT NULL,
	`success` integer NOT NULL CHECK (`success` IN (0, 1)),
	`failure_reason` text,
	`ip_address` text,
	`user_agent` text,
	`device_summary` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `login_history_user_created_idx` ON `login_history` (`user_id`, `created_at`);--> statement-breakpoint
CREATE INDEX `login_history_fingerprint_created_idx` ON `login_history` (`identifier_fingerprint`, `created_at`);--> statement-breakpoint
CREATE INDEX `login_history_ip_created_idx` ON `login_history` (`ip_address`, `created_at`);--> statement-breakpoint
CREATE TABLE `organizational_units` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL CHECK (`type` IN ('CONVENCAO', 'MATRIZ', 'FILIAL')),
	`name` text NOT NULL,
	`code` text NOT NULL,
	`parent_id` integer,
	`status` text DEFAULT 'ATIVO' NOT NULL CHECK (`status` IN ('ATIVO', 'INATIVO')),
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `organizational_units`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK ((`type` = 'CONVENCAO' AND `parent_id` IS NULL) OR (`type` IN ('MATRIZ', 'FILIAL') AND `parent_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizational_units_code_unique` ON `organizational_units` (`code`);--> statement-breakpoint
CREATE INDEX `organizational_units_parent_idx` ON `organizational_units` (`parent_id`, `type`, `status`);--> statement-breakpoint
CREATE TABLE `user_unit_links` (
	`user_id` integer NOT NULL,
	`unit_id` integer NOT NULL,
	`is_primary` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `unit_id`),
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_unit_primary_unique` ON `user_unit_links` (`user_id`) WHERE `is_primary` = 1;--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expires_at`);

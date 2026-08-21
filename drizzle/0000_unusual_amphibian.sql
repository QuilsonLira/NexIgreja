CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`event` text NOT NULL,
	`identifier_type` text,
	`reason` text NOT NULL,
	`matrix_id` integer,
	`branch_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` integer PRIMARY KEY NOT NULL,
	`matrix_id` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	FOREIGN KEY (`matrix_id`) REFERENCES `matrices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `matrices` (
	`id` integer PRIMARY KEY NOT NULL,
	`convention_id` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'ATIVO' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` integer NOT NULL,
	`active_matrix_id` integer,
	`active_branch_id` integer,
	`previous_login_at` text,
	`previous_identifier_type` text,
	`previous_origin_summary` text,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`convention_id` integer NOT NULL,
	`name` text NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`cpf` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_hash` text NOT NULL,
	`role_name` text NOT NULL,
	`scope` text NOT NULL,
	`bound_matrix_id` integer,
	`bound_branch_id` integer,
	`status` text DEFAULT 'ATIVO' NOT NULL,
	`must_change_password` integer DEFAULT false NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`blocked_until` text,
	`last_login_at` text,
	`last_identifier_type` text,
	`last_origin_summary` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_cpf_unique` ON `users` (`cpf`);
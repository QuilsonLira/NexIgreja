CREATE TABLE `unit_logos` (
	`unit_id` integer PRIMARY KEY NOT NULL,
	`image_data` blob NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `organizational_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profile_photos` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`image_data` blob NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action
);

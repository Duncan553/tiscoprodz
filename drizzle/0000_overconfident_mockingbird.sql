CREATE TABLE `beats` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`bpm` integer NOT NULL,
	`musical_key` text NOT NULL,
	`genre` text NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`cover_key` text NOT NULL,
	`preview_key` text NOT NULL,
	`mp3_key` text NOT NULL,
	`wav_key` text,
	`stems_key` text,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `beats_published_created_idx` ON `beats` (`published`,`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`reference` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`amount_usd_cents` integer NOT NULL,
	`subtotal_usd_cents` integer NOT NULL,
	`discount_usd_cents` integer DEFAULT 0 NOT NULL,
	`producer_usd_cents` integer DEFAULT 0 NOT NULL,
	`platform_usd_cents` integer DEFAULT 0 NOT NULL,
	`split_applied` integer DEFAULT 0 NOT NULL,
	`items` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`download_token` text NOT NULL,
	`processor_data` text,
	`created_at` integer NOT NULL,
	`paid_at` integer
);
--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`kind` text NOT NULL,
	`bytes` integer NOT NULL,
	`month` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `uploads_month_idx` ON `uploads` (`month`);
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`property_id` text,
	`principal_cents` integer NOT NULL,
	`rate` real NOT NULL,
	`term_months` integer NOT NULL,
	`first_payment` text NOT NULL,
	`insurance_cents` integer DEFAULT 0 NOT NULL,
	`manual_payment_cents` integer,
	`manual_balance_cents` integer,
	`manual_balance_date` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`value_cents` integer NOT NULL,
	`value_date` text,
	`purchase_price_cents` integer,
	`purchase_date` text,
	`share` real DEFAULT 1 NOT NULL,
	`in_allocation` integer DEFAULT false NOT NULL,
	`class_id` text,
	`comment` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);

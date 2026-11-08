CREATE TABLE `crowd_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`rate` real NOT NULL,
	`start_date` text NOT NULL,
	`term_months` integer NOT NULL,
	`repayment` text NOT NULL,
	`status` text DEFAULT 'en_cours' NOT NULL,
	`status_date` text,
	`repaid_capital_cents` integer,
	`expected_recovery_cents` integer,
	`in_allocation` integer,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);

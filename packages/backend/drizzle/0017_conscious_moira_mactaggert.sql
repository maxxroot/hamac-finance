PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_crowd_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`rate` real,
	`start_date` text NOT NULL,
	`term_months` integer,
	`repayment` text NOT NULL,
	`status` text DEFAULT 'en_cours' NOT NULL,
	`status_date` text,
	`repaid_capital_cents` integer,
	`expected_recovery_cents` integer,
	`in_allocation` integer,
	`comment` text DEFAULT '' NOT NULL,
	`external_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_crowd_projects`("id", "account_id", "name", "amount_cents", "rate", "start_date", "term_months", "repayment", "status", "status_date", "repaid_capital_cents", "expected_recovery_cents", "in_allocation", "comment", "created_at", "updated_at") SELECT "id", "account_id", "name", "amount_cents", "rate", "start_date", "term_months", "repayment", "status", "status_date", "repaid_capital_cents", "expected_recovery_cents", "in_allocation", "comment", "created_at", "updated_at" FROM `crowd_projects`;--> statement-breakpoint
DROP TABLE `crowd_projects`;--> statement-breakpoint
ALTER TABLE `__new_crowd_projects` RENAME TO `crowd_projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `crowd_external_uq` ON `crowd_projects` (`account_id`,`external_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tx_external_uq` ON `transactions` (`account_id`,`external_id`);
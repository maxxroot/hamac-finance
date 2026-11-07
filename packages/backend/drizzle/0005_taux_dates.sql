CREATE TABLE `account_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`from_date` text NOT NULL,
	`rate` real NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_rates_account_date_uq` ON `account_rates` (`account_id`,`from_date`);--> statement-breakpoint
-- Reprise : le taux actuel de chaque livret devient son premier taux daté (date d'ouverture, sinon de création).
INSERT INTO `account_rates` (`id`, `account_id`, `from_date`, `rate`, `comment`)
SELECT lower(hex(randomblob(16))), `id`, coalesce(`opened_on`, substr(`created_at`, 1, 10)), `rate`, 'Taux repris à la mise à jour'
FROM `accounts` WHERE `kind` = 'livret' AND `rate` IS NOT NULL;

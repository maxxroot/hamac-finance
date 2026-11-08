PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`value_cents` integer NOT NULL,
	`value_date` text,
	`purchase_price_cents` integer,
	`purchase_date` text,
	`share` real DEFAULT 1 NOT NULL,
	`in_allocation` integer,
	`class_id` text,
	`comment` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_properties`("id", "kind", "name", "value_cents", "value_date", "purchase_price_cents", "purchase_date", "share", "in_allocation", "class_id", "comment", "archived", "created_at", "updated_at") SELECT "id", "kind", "name", "value_cents", "value_date", "purchase_price_cents", "purchase_date", "share", "in_allocation", "class_id", "comment", "archived", "created_at", "updated_at" FROM `properties`;--> statement-breakpoint
DROP TABLE `properties`;--> statement-breakpoint
ALTER TABLE `__new_properties` RENAME TO `properties`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
UPDATE `properties` SET `in_allocation` = NULL WHERE `in_allocation` = 0;

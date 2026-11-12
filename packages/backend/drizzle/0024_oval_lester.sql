CREATE TABLE "property_reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"lot_id" text,
	"date" text NOT NULL,
	"yearly" boolean DEFAULT false NOT NULL,
	"label" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"done_on" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_reminders" ADD CONSTRAINT "property_reminders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_reminders" ADD CONSTRAINT "property_reminders_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_reminders_property_idx" ON "property_reminders" USING btree ("property_id");
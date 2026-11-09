CREATE TABLE "property_incomes" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "deposit_returned_cents" bigint;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "deposit_returned_on" text;--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "deposit_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "property_incomes" ADD CONSTRAINT "property_incomes_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_incomes_property_idx" ON "property_incomes" USING btree ("property_id");
CREATE TABLE "property_values" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"date" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "closed_on" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_date" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_price_cents" bigint;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "sale_fees_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "property_expenses" ADD COLUMN "improvement" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "property_values" ADD CONSTRAINT "property_values_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_values_property_date_uq" ON "property_values" USING btree ("property_id","date");
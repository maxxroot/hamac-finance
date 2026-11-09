CREATE TABLE "property_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"date" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"yearly" boolean DEFAULT false NOT NULL,
	"until_year" bigint,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"month" text NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" bigint,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_expenses" ADD CONSTRAINT "property_expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_exceptions" ADD CONSTRAINT "rent_exceptions_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_expenses_property_idx" ON "property_expenses" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rent_exceptions_lease_month_uq" ON "rent_exceptions" USING btree ("lease_id","month");
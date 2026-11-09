CREATE TABLE "lease_rents" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"from_month" text NOT NULL,
	"rent_cents" bigint NOT NULL,
	"charges_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"kind" text NOT NULL,
	"tenant" text DEFAULT '' NOT NULL,
	"start_date" text NOT NULL,
	"duration_months" bigint NOT NULL,
	"rent_cents" bigint NOT NULL,
	"charges_cents" bigint DEFAULT 0 NOT NULL,
	"deposit_cents" bigint DEFAULT 0 NOT NULL,
	"notice_by" text,
	"notice_date" text,
	"notice_months" bigint,
	"actual_end" text,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lease_rents" ADD CONSTRAINT "lease_rents_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lease_rents_lease_month_uq" ON "lease_rents" USING btree ("lease_id","from_month");--> statement-breakpoint
CREATE INDEX "leases_property_idx" ON "leases" USING btree ("property_id");
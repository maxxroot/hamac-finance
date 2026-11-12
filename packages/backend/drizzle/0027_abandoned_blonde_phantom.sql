CREATE TABLE "rent_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"level" text NOT NULL,
	"sent_on" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rent_notices" ADD CONSTRAINT "rent_notices_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rent_notices_lease_idx" ON "rent_notices" USING btree ("lease_id");
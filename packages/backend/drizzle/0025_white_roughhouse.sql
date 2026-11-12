CREATE TABLE "rent_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"month" text NOT NULL,
	"date" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"method" text DEFAULT 'virement' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_waivers" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"month" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leases" ADD COLUMN "due_day" bigint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_waivers" ADD CONSTRAINT "rent_waivers_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rent_payments_lease_idx" ON "rent_payments" USING btree ("lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rent_waivers_lease_month_uq" ON "rent_waivers" USING btree ("lease_id","month");--> statement-breakpoint
INSERT INTO "rent_payments" ("id", "lease_id", "month", "date", "amount_cents", "method", "comment") SELECT md5('paiement:' || e."id")::uuid::text, e."lease_id", e."month", e."month" || '-01', e."amount_cents" + COALESCE((SELECT r."charges_cents" FROM "lease_rents" r WHERE r."lease_id" = e."lease_id" AND r."from_month" <= e."month" ORDER BY r."from_month" DESC LIMIT 1), l."charges_cents"), 'autre', 'Repris du montant signalé avant le suivi des paiements' FROM "rent_exceptions" e JOIN "leases" l ON l."id" = e."lease_id" WHERE e."kind" = 'montant' AND e."amount_cents" IS NOT NULL;--> statement-breakpoint
INSERT INTO "rent_waivers" ("id", "lease_id", "month", "comment") SELECT md5('remise:' || "id")::uuid::text, "lease_id", "month", CASE WHEN btrim("comment") = '' THEN 'Ancien « mois vide »' ELSE "comment" END FROM "rent_exceptions" WHERE "kind" = 'vide';